package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.UserPinEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserPinMapper {
    // PIN 번호 등록 및 재설정 (ON DUPLICATE KEY UPDATE 활용)
    int insertUserPin(@Param("userId") Integer userId, @Param("pinHash") String pinHash);
    UserPinEntity getUserPin(@Param("userId") Integer userId);
    int deleteUserPin(@Param("userId") Integer userId);
    int update(@Param("userId") Integer userId, @Param("encodedPin") String encodedPin);
    int resetFailCount(@Param("userId") Integer userId);
    int recordFailedAttempt(@Param("userId") Integer userId,
                            @Param("failCount") Integer failCount,
                            @Param("lockedUntil") java.time.LocalDateTime lockedUntil);
}
