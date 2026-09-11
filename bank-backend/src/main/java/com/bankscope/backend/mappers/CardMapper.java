package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.CardEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface CardMapper {
    int insertCard(@Param("card") CardEntity card);

    List<CardEntity> selectCardsByUserId(@Param("userId") Integer userId);

    CardEntity selectCardByIdAndUserId(@Param("cardId") Long cardId, @Param("userId") Integer userId);

    int updateCardStatus(@Param("cardId") Long cardId, @Param("status") String status, @Param("userId") Integer userId);

    int deleteCard(@Param("cardId") Long cardId, @Param("userId") Integer userId);
}