package com.bankscope.backend.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 주민등록번호 등 민감 식별자 보호 유틸.
 *
 * <p>저장: AES-GCM(랜덤 IV) — 동일 평문도 매번 다른 암호문이라 암호문에서 정보가 새지 않는다.
 * <p>검색: HMAC-SHA256 블라인드 인덱스 — 결정적이므로 동등 검색이 가능하되, 키 없이는 역산 불가.
 * <p>키는 소스에 두지 않고 외부 설정에서 주입한다. 정적 호출부 유지를 위해 setter 주입값을 static 필드에 보관한다.
 */
@Component
public class AESUtil {

    private static final int GCM_IV_LENGTH = 12;       // 96-bit IV (GCM 권장)
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static String AES_KEY;   // AES-GCM 대칭키 (16/24/32바이트)
    private static String HMAC_KEY;  // 블라인드 인덱스용 HMAC 키

    @Value("${app.aes.secret-key}")
    public void setAesKey(String key) {
        // 설정값에 들어간 앞뒤 공백/개행으로 키가 달라지는 사고를 방지하기 위해 trim 한다.
        AESUtil.AES_KEY = key == null ? null : key.trim();
    }

    @Value("${app.hmac.secret-key}")
    public void setHmacKey(String key) {
        AESUtil.HMAC_KEY = key == null ? null : key.trim();
    }

    /** AES-GCM 암호화. 출력 = Base64(IV || ciphertext || tag). */
    public static String encrypt(String plainText) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            RANDOM.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec(AES_KEY),
                    new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] out = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(cipherText, 0, out, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    /** AES-GCM 복호화. 입력 = Base64(IV || ciphertext || tag). */
    public static String decrypt(String encryptedText) {
        try {
            byte[] all = Base64.getDecoder().decode(encryptedText);
            byte[] iv = new byte[GCM_IV_LENGTH];
            System.arraycopy(all, 0, iv, 0, GCM_IV_LENGTH);
            byte[] cipherText = new byte[all.length - GCM_IV_LENGTH];
            System.arraycopy(all, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec(AES_KEY),
                    new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * 블라인드 인덱스: HMAC-SHA256(키, 정규화된 평문). 동등 검색용.
     * 하이픈을 제거해 '900101-1234567'과 '9001011234567'이 같은 인덱스를 갖게 한다.
     */
    public static String blindIndex(String plainText) {
        try {
            String normalized = plainText.replace("-", "");
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(HMAC_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private static SecretKeySpec keySpec(String key) {
        return new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
    }
}
