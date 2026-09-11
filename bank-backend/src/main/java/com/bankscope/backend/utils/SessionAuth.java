package com.bankscope.backend.utils;

import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import jakarta.servlet.http.HttpSession;

public final class SessionAuth {
    private SessionAuth() {
    }

    public static UserEntity user(HttpSession session) {
        return session == null ? null : (UserEntity) session.getAttribute("user");
    }

    public static MemberEntity member(HttpSession session) {
        return session == null ? null : (MemberEntity) session.getAttribute("member");
    }

    public static boolean isMember(HttpSession session) {
        return member(session) != null;
    }

    public static boolean isAdmin(HttpSession session) {
        UserEntity user = user(session);
        return user != null && "admin".equals(user.getUserType());
    }

    public static boolean isMemberOrAdmin(HttpSession session) {
        return isMember(session) || isAdmin(session);
    }

    public static boolean isWebUser(HttpSession session) {
        return user(session) != null && "web".equals(session.getAttribute("loginType"));
    }

    public static boolean isSameUser(HttpSession session, Integer userId) {
        UserEntity user = user(session);
        return user != null && userId != null && userId.equals(user.getId());
    }
}
