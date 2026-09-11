package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.SavingsAccountEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SavingsAccountMapper {
    // 적금 상세 정보 저장
    void insertSavingsAccount(SavingsAccountEntity savingsAccount);

    // 적금 상세 정보 조회 (배치 스케줄러에서 사용 예정)
    SavingsAccountEntity selectSavingsAccountById(Long accountId);
}