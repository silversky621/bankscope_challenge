package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.TransactionHistoryEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TransactionHistoryMapper {
    int insertTransaction(@Param("transaction") TransactionHistoryEntity transaction);
}
