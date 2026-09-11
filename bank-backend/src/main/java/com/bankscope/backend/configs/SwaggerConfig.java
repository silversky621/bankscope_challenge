package com.bankscope.backend.configs;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server; // ✅ 이 import가 새로 필요합니다!
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                // 👇 이 줄을 추가하세요! (서버 주소를 현재 접속한 주소 기준으로 설정)
                .addServersItem(new Server().url("/"))
                .info(new Info()
                        .title("Bank Backend API")
                        .description("프론트엔드 협업용 API 명세서입니다.")
                        .version("1.0.0"));
    }
}