package com.bankscope.backend.configs;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
//      /ws - chat →프론트가 연결하는 주소
//      / app /... →프론트가 서버로 보낼 때
//      /topic /... →서버가 구독자에게 뿌릴 때
        registry.addEndpoint("/ws-chat")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 클라이언트 → 서버
        registry.setApplicationDestinationPrefixes("/app");

        // 서버 → 클라이언트
        registry.enableSimpleBroker("/topic");
    }
}
