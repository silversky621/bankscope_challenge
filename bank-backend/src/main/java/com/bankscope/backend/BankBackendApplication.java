package com.bankscope.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling; // ✨ 추가

@EnableScheduling
@SpringBootApplication
public class BankBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BankBackendApplication.class, args);
    }

}
