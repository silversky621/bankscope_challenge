package com.bankscope.backend.config;

import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Map;

@Configuration
public class FlywaySecretPlaceholderConfig {

    public static final String AES_KEY_PLACEHOLDER = "bankscope.aesSecretKey";
    public static final String HMAC_KEY_PLACEHOLDER = "bankscope.hmacSecretKey";

    @Bean
    public FlywayConfigurationCustomizer flywaySecretPlaceholders(Environment environment) {
        return (FluentConfiguration configuration) -> configuration.placeholders(Map.of(
                AES_KEY_PLACEHOLDER, requiredProperty(environment, "app.aes.secret-key"),
                HMAC_KEY_PLACEHOLDER, requiredProperty(environment, "app.hmac.secret-key")
        ));
    }

    private static String requiredProperty(Environment environment, String name) {
        String value = environment.getProperty(name);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalStateException("Missing required property: " + name);
        }
        return value.trim();
    }
}
