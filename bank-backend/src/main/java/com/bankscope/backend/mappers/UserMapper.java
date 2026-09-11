package com.bankscope.backend.mappers;


import com.bankscope.backend.entities.EmailTokenEntity;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserMapper {

    int insertUser (@Param(value = "user") UserEntity user);
    int insertMember(@Param(value = "member") MemberEntity member);
    int deleteMember( @Param(value = "id") Long id);
    int updateMember(@Param(value = "member") MemberEntity member);
    int insertUnregisteredUser(@Param(value = "user") UserEntity user);
    List<MemberEntity> selectMembers();
    UserEntity selectUserByEmailPasswordAndResidentNumber(@Param(value = "email") String email, @Param(value = "password") String password, @Param(value = "residentNumber") String residentNumber);
    UserEntity selectUserByEmail(@Param("email") String email);
    UserEntity selectUserByEmailAndPassword(@Param(value = "email") String email, @Param(value = "password") String password);
    UserEntity selectUserByResidentNumber(@Param(value = "residentNumber") String residentNumber);
    UserEntity selectUserById(@Param(value = "userId") String userId);
    MemberEntity selectMemberByEmail(@Param(value = "email") String email);
    UserEntity selectUserById(@Param("id") Integer id);
    int updateUnregisteredUserToCustomer(@Param("user") UserEntity user);
    int updateUnregisteredUserToCorporate(@Param("user") UserEntity user);
    int updatePassword(@Param("email") String email, @Param("password") String password);
    int updatePasswordAndName(@Param("email") String email, @Param("password") String password, @Param("name") String name);
    int updateMemberStatus(@Param("email") String email, @Param("status") int status);
    int updateUserIdentificationNumber(@Param("user") UserEntity user);

    int insertEmailToken(@Param("token") EmailTokenEntity emailToken);
    EmailTokenEntity selectEmailToken(@Param("email") String email, @Param("code") String code);
    int updateEmailTokenAsUsed(@Param("token") EmailTokenEntity emailToken);
}
