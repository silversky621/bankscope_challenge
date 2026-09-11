package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.AccountEntity;
import com.bankscope.backend.entities.DepositAccountEntity;
import com.bankscope.backend.vos.AccountVo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface AccountMapper {
    int insertAccount(@Param("account") AccountEntity account);
    AccountVo selectAccountById(@Param("id") Long id);
    AccountVo selectAccountByAccountNumber(@Param("accountNumber") String accountNumber);
    List<AccountVo> selectAccountsByUserId(@Param("userId") Integer userId);
    int countByAccountNumber(@Param("accountNumber") String accountNumber);
    int updateBalance(@Param("accountId") Long accountId, @Param("balance") Long balance);
    int addBalance(@Param("accountId") Long accountId, @Param("amount") Long amount);
    int updateAccountPassword(AccountVo accountVo);
    int insertDepositAccount(@Param("deposit") DepositAccountEntity deposit);
    List<AccountEntity> findMaturedDepositAccounts(@Param("today") LocalDate today);
    DepositAccountEntity findDepositAccountByAccountId(@Param("accountId") Long accountId);
    int updateAccountStatus(AccountEntity account);
    int updateMaturityDateForTest(@Param("accountId") Long accountId, @Param("maturityDate") LocalDateTime maturityDate);
}