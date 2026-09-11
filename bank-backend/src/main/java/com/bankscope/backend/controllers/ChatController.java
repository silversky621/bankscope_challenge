package com.bankscope.backend.controllers;


import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.RestController;


@Tag(name = "채팅(Chat)", description = "채팅 관련 API")
@RestController
public class ChatController {

/*    @RequestMapping(value="/room", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> postRoom(@SessionAttribute(value="sessionUser", required = false)SessionUser sessionUser,
                                        @RequestParam int targetUserId
    ) {
        if (sessionUser == null) {
            return Map.of("result", "LOGIN_REQUIRED");
        }
        int userId = sessionUser.getUserId();
        int roomId = chatService.createOrGetRoom(userId, targetUserId);

        return Map.of("result", "SUCCESS", "roomId", roomId);
    }
    // 채팅 메세지 전체 불러오기
    @RequestMapping(value="/room/{roomId}/messages", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getMessages(
            @SessionAttribute(value="sessionUser", required = false) SessionUser sessionUser,
            @PathVariable int roomId) {

        if (sessionUser == null) {
            return Map.of("result", "LOGIN_REQUIRED");
        }

        List<ChatMessageDto> messages = chatService.getMessages(roomId);

        return Map.of(
                "result", "SUCCESS",
                "messages", messages
        );
    }
    // 채팅방 리스트 불러오기
    @RequestMapping(value="/rooms", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getRooms (@SessionAttribute(value="sessionUser", required = false) SessionUser sessionUser) {
        if (sessionUser == null) {
            return Map.of("result", "LOGIN_REQUIRED");
        }
        int userId = sessionUser.getUserId();
        List<ChatRoomListDto> rooms = chatService.getChatRooms(userId);

        return Map.of("result", "SUCCESS", "rooms", rooms);
    }*/
}
