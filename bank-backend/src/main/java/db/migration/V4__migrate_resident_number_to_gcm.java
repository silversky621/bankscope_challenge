package db.migration;

import com.bankscope.backend.config.FlywaySecretPlaceholderConfig;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

public class V4__migrate_resident_number_to_gcm extends BaseJavaMigration {

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public void migrate(Context context) throws Exception {
        Map<String, String> placeholders = context.getConfiguration().getPlaceholders();
        String aesKey = requiredPlaceholder(placeholders, FlywaySecretPlaceholderConfig.AES_KEY_PLACEHOLDER);
        String hmacKey = requiredPlaceholder(placeholders, FlywaySecretPlaceholderConfig.HMAC_KEY_PLACEHOLDER);
        validateAesKey(aesKey);

        Connection connection = context.getConnection();
        addEncryptedResidentNumberColumn(connection);
        List<SeedResidentNumber> seedRows = selectSeedResidentNumbers(connection, aesKey, hmacKey);
        if (!seedRows.isEmpty()) {
            updateResidentNumbers(connection, seedRows, aesKey, hmacKey);
        }
    }

    private static void addEncryptedResidentNumberColumn(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE `bank`.`user` ADD COLUMN `resident_number_enc` VARCHAR(255) NULL AFTER `resident_number`");
        } catch (SQLException e) {
            // MySQL DDL may already have succeeded during an interrupted migration.
            if (e.getErrorCode() != 1060) {
                throw e;
            }
        }
    }

    private static List<SeedResidentNumber> selectSeedResidentNumbers(
            Connection connection, String aesKey, String hmacKey) throws Exception {
        List<SeedResidentNumber> rows = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(
                     "SELECT `id`, `resident_number`, `resident_number_enc` FROM `bank`.`user`")) {
            while (resultSet.next()) {
                int userId = resultSet.getInt("id");
                String storedResidentNumber = resultSet.getString("resident_number");
                String residentNumber = normalizeResidentNumber(storedResidentNumber);
                if (residentNumber != null && residentNumber.matches("\\d{13}")) {
                    rows.add(new SeedResidentNumber(userId, residentNumber));
                } else {
                    // Skip only verified AES-GCM/HMAC pairs, never unknown legacy values.
                    validateMigratedResidentNumber(userId, storedResidentNumber,
                            resultSet.getString("resident_number_enc"), aesKey, hmacKey);
                }
            }
        }
        return rows;
    }

    private static void validateMigratedResidentNumber(
            int userId, String storedIndex, String encryptedValue, String aesKey, String hmacKey) {
        try {
            if (encryptedValue == null || encryptedValue.isBlank()) {
                throw new IllegalArgumentException("Missing AES-GCM ciphertext.");
            }
            byte[] encrypted = Base64.getDecoder().decode(encryptedValue);
            if (encrypted.length < GCM_IV_LENGTH + GCM_TAG_LENGTH_BITS / 8) {
                throw new IllegalArgumentException("Incomplete AES-GCM ciphertext.");
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(aesKey.getBytes(StandardCharsets.UTF_8), "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH_BITS, encrypted, 0, GCM_IV_LENGTH));
            String residentNumber = normalizeResidentNumber(new String(
                    cipher.doFinal(encrypted, GCM_IV_LENGTH, encrypted.length - GCM_IV_LENGTH),
                    StandardCharsets.UTF_8));
            if (!residentNumber.matches("\\d{13}") || !blindIndex(residentNumber, hmacKey).equals(storedIndex)) {
                throw new IllegalArgumentException("Resident number and HMAC index do not match.");
            }
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException(
                    "V4 found incomplete or invalid resident number encryption. user id: " + userId, e);
        }
    }

    private static void updateResidentNumbers(
            Connection connection,
            List<SeedResidentNumber> seedRows,
            String aesKey,
            String hmacKey) throws Exception {
        String sql = "UPDATE `bank`.`user` SET `resident_number` = ?, `resident_number_enc` = ? WHERE `id` = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (SeedResidentNumber row : seedRows) {
                statement.setString(1, blindIndex(row.residentNumber(), hmacKey));
                statement.setString(2, encrypt(row.residentNumber(), aesKey));
                statement.setInt(3, row.userId());
                int updated = statement.executeUpdate();
                if (updated != 1) {
                    throw new IllegalStateException("Resident number migration failed for user id " + row.userId());
                }
            }
        }
    }

    private static String encrypt(String plainText, String aesKey) throws GeneralSecurityException {
        byte[] iv = new byte[GCM_IV_LENGTH];
        RANDOM.nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(aesKey.getBytes(StandardCharsets.UTF_8), "AES"),
                new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
        byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

        byte[] out = new byte[iv.length + cipherText.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(cipherText, 0, out, iv.length, cipherText.length);
        return Base64.getEncoder().encodeToString(out);
    }

    private static String blindIndex(String plainText, String hmacKey) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(hmacKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(normalizeResidentNumber(plainText).getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(digest);
    }

    private static String normalizeResidentNumber(String residentNumber) {
        return residentNumber == null ? null : residentNumber.replace("-", "").trim();
    }

    private static void validateAesKey(String aesKey) {
        int byteLength = aesKey.getBytes(StandardCharsets.UTF_8).length;
        if (byteLength != 16 && byteLength != 24 && byteLength != 32) {
            throw new IllegalStateException("app.aes.secret-key must be exactly 16, 24, or 32 bytes.");
        }
    }

    private static String requiredPlaceholder(Map<String, String> placeholders, String name) {
        String value = placeholders.get(name);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Missing Flyway placeholder: " + name);
        }
        return value.trim();
    }

    private record SeedResidentNumber(int userId, String residentNumber) {
    }
}
