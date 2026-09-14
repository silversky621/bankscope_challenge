package db.migration;

import com.bankscope.backend.config.FlywaySecretPlaceholderConfig;
import com.bankscope.backend.utils.AESUtil;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class V4ResidentNumberMigrationTest {
    private static final String AES_KEY = "0123456789abcdef";
    private static final String HMAC_KEY = "migration-test-hmac-key";
    private static final String RESIDENT_NUMBER = "1234567890123";

    private final Context context = mock(Context.class);
    private final Configuration configuration = mock(Configuration.class);
    private final Connection connection = mock(Connection.class);
    private final Statement ddl = mock(Statement.class);
    private final Statement query = mock(Statement.class);
    private final ResultSet resultSet = mock(ResultSet.class);
    private final PreparedStatement update = mock(PreparedStatement.class);
    private final Map<String, String> placeholders = new HashMap<>();
    private final V4__migrate_resident_number_to_gcm migration = new V4__migrate_resident_number_to_gcm();

    @BeforeEach
    void setUp() throws Exception {
        placeholders.put(FlywaySecretPlaceholderConfig.AES_KEY_PLACEHOLDER, AES_KEY);
        placeholders.put(FlywaySecretPlaceholderConfig.HMAC_KEY_PLACEHOLDER, HMAC_KEY);
        when(context.getConfiguration()).thenReturn(configuration);
        when(configuration.getPlaceholders()).thenReturn(placeholders);
        when(context.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(ddl, query);
        when(query.executeQuery(anyString())).thenReturn(resultSet);
        when(connection.prepareStatement(anyString())).thenReturn(update);
        when(update.executeUpdate()).thenReturn(1);

        // Verify compatibility with the encryption and lookup code used by the application.
        AESUtil encryption = new AESUtil();
        encryption.setAesKey(AES_KEY);
        encryption.setHmacKey(HMAC_KEY);
    }

    @ParameterizedTest
    @ValueSource(strings = {RESIDENT_NUMBER, " 123456-7890123 "})
    void migratesPlaintextIntoApplicationCompatibleCiphertextAndIndex(String plaintext) throws Exception {
        rows(new ResidentRow(1, plaintext, null));

        migration.migrate(context);

        ArgumentCaptor<String> ciphertext = ArgumentCaptor.forClass(String.class);
        verify(update).setString(1, AESUtil.blindIndex(RESIDENT_NUMBER));
        verify(update).setString(eq(2), ciphertext.capture());
        verify(update).setInt(3, 1);
        verify(update).executeUpdate();
        assertEquals(RESIDENT_NUMBER, AESUtil.decrypt(ciphertext.getValue()));
    }

    @Test
    void rerunSkipsVerifiedEncryptedRowsWhenColumnAlreadyExists() throws Exception {
        when(ddl.execute(anyString())).thenThrow(new SQLException(null, "42S21", 1060));
        rows(encryptedRow(1));

        assertDoesNotThrow(() -> migration.migrate(context));

        verify(connection, never()).prepareStatement(anyString());
    }

    @Test
    void resumesMixedDataWithoutRewritingPreviouslyEncryptedRows() throws Exception {
        when(ddl.execute(anyString())).thenThrow(new SQLException("Duplicate column", "42S21", 1060));
        rows(encryptedRow(1), new ResidentRow(2, "2345678901234", null));

        migration.migrate(context);

        verify(update).setString(1, AESUtil.blindIndex("2345678901234"));
        verify(update).setInt(3, 2);
        verify(update, times(1)).executeUpdate();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "short-plaintext", "legacy-format", "missing-ciphertext", "blank-ciphertext",
            "invalid-base64", "truncated-ciphertext", "tampered-ciphertext", "wrong-index",
            "wrong-aes-key", "wrong-hmac-key", "encrypted-invalid-plaintext", "null-index"
    })
    void rejectsUnverifiedRowsBeforeUpdatingAnyPlaintext(String scenario) throws Exception {
        ResidentRow valid = encryptedRow(2);
        ResidentRow invalid = switch (scenario) {
            case "short-plaintext" -> new ResidentRow(2, "123456789012", null);
            case "legacy-format" -> new ResidentRow(2, "legacy-encrypted-value", null);
            case "missing-ciphertext" -> new ResidentRow(2, valid.index(), null);
            case "blank-ciphertext" -> new ResidentRow(2, valid.index(), " ");
            case "invalid-base64" -> new ResidentRow(2, valid.index(), "not-base64!");
            case "truncated-ciphertext" -> new ResidentRow(2, valid.index(), "AA==");
            case "tampered-ciphertext" -> {
                byte[] ciphertext = Base64.getDecoder().decode(valid.encrypted());
                ciphertext[ciphertext.length - 1] ^= 1;
                yield new ResidentRow(2, valid.index(), Base64.getEncoder().encodeToString(ciphertext));
            }
            case "wrong-index" -> new ResidentRow(2, AESUtil.blindIndex("2345678901234"), valid.encrypted());
            case "wrong-aes-key" -> {
                placeholders.put(FlywaySecretPlaceholderConfig.AES_KEY_PLACEHOLDER, "fedcba9876543210");
                yield valid;
            }
            case "wrong-hmac-key" -> {
                placeholders.put(FlywaySecretPlaceholderConfig.HMAC_KEY_PLACEHOLDER, "different-test-hmac-key");
                yield valid;
            }
            case "encrypted-invalid-plaintext" ->
                    new ResidentRow(2, AESUtil.blindIndex("invalid"), AESUtil.encrypt("invalid"));
            case "null-index" -> new ResidentRow(2, null, valid.encrypted());
            default -> throw new IllegalArgumentException(scenario);
        };
        // Even if a valid plaintext row comes first, no updates happen before all rows validate.
        rows(new ResidentRow(1, RESIDENT_NUMBER, null), invalid);

        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> migration.migrate(context));

        assertTrue(failure.getMessage().contains("user id: 2"));
        assertFalse(failure.getMessage().contains(RESIDENT_NUMBER));
        verify(connection, never()).prepareStatement(anyString());
    }

    @Test
    void allowsAnEmptyUserTable() throws Exception {
        rows();

        assertDoesNotThrow(() -> migration.migrate(context));

        verify(connection, never()).prepareStatement(anyString());
    }

    @Test
    void propagatesSqlErrorsOtherThanDuplicateColumn() throws Exception {
        SQLException denied = new SQLException(null, "42000", 1142);
        when(ddl.execute(anyString())).thenThrow(denied);

        assertSame(denied, assertThrows(SQLException.class, () -> migration.migrate(context)));

        verify(query, never()).executeQuery(anyString());
    }

    private ResidentRow encryptedRow(int id) {
        return new ResidentRow(id, AESUtil.blindIndex(RESIDENT_NUMBER), AESUtil.encrypt(RESIDENT_NUMBER));
    }

    private void rows(ResidentRow... values) throws Exception {
        List<ResidentRow> rows = List.of(values);
        AtomicInteger index = new AtomicInteger(-1);
        when(resultSet.next()).thenAnswer(call -> index.incrementAndGet() < rows.size());
        when(resultSet.getInt("id")).thenAnswer(call -> rows.get(index.get()).id());
        when(resultSet.getString("resident_number")).thenAnswer(call -> rows.get(index.get()).index());
        when(resultSet.getString("resident_number_enc")).thenAnswer(call -> rows.get(index.get()).encrypted());
    }

    private record ResidentRow(int id, String index, String encrypted) {
    }
}
