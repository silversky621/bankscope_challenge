package com.bankscope.backend.services;


import com.bankscope.backend.entities.EmailTokenEntity;
import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.enums.Gender;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.results.EmailResult;
import com.bankscope.backend.results.KioskResult;
import com.bankscope.backend.utils.AESUtil;
import com.bankscope.backend.valitators.UserValidator;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String mailFrom;

    public CommonResult  register(UserEntity user) {

        if (user.getIsTermsAgreed() == null || user.getIsTermsAgreed() != 1) {
            return CommonResult.FAILURE_NOT_AGREED;
        }

        if (user.getName() == null || user.getEmail() == null || user.getPassword() == null || user.getResidentNumber() == null || user.getPhone() == null) {
            return CommonResult.FAILURE;
        }


        // 이메일 중복 체크 (정식 등록된 유저 대상)
        UserEntity existingUserByEmail = this.userMapper.selectUserByEmail(user.getEmail());
        if (existingUserByEmail != null && ("customer".equals(existingUserByEmail.getUserType()) || "corporate".equals(existingUserByEmail.getUserType()))) {
            return CommonResult.FAILURE;
        }
        setGenderAndAgeFromResidentNumber(user); // 성별/나이 계산


        // 기업회원의 경우 사업자 번호 필수
        if (("corporate".equals(user.getUserType())) && (user.getIdentificationNumber() == null)) {
            return CommonResult.FAILURE;
        }

        // 주민등록번호: 검색용 블라인드 인덱스(HMAC) + 저장용 AES-GCM 암호문 생성 (평문 기준으로 먼저 계산)
        String rrnIndex = AESUtil.blindIndex(user.getResidentNumber());
        String rrnEnc = AESUtil.encrypt(user.getResidentNumber());
        UserEntity dbUser = this.userMapper.selectUserByResidentNumber(rrnIndex);

        // 비밀번호 해싱
        user.setPassword(encoder.encode(user.getPassword()));
        // resident_number = 블라인드 인덱스(검색용), resident_number_enc = GCM 암호문(복호화용)
        user.setResidentNumberEnc(rrnEnc);
        user.setResidentNumber(rrnIndex);

        int result;
        // dbUser가 있고(키오스크나 워크스페이스를 통해 가입된 적이 있음), 정식 회원이 아닌 경우
        if (dbUser != null && ("unregisterCustomer".equals(dbUser.getUserType()) || "corporate".equals(dbUser.getUserType()))) {
            if ("corporate".equals(user.getUserType())) {
                // 워크스페이스에서 등록된 비회원(사업자)이 웹사이트에서 가입하는 경우
                // 기존 정보에 사업자 번호가 존재하고 일치하는지 확인
                if (dbUser.getIdentificationNumber() == null || !dbUser.getIdentificationNumber().equals(user.getIdentificationNumber())) {
                    return CommonResult.FAILURE; // 사업자 번호가 불일치하거나 등록되지 않은 경우 실패
                }
                // 일치하는 경우, 기존 비회원 정보를 정식 기업 회원 정보로 업데이트
                result = this.userMapper.updateUnregisteredUserToCorporate(user);
            } else {
                // 일반 개인 고객인 경우
                result = this.userMapper.updateUnregisteredUserToCustomer(user);
            }
        } else {
            // 신규 유저의 경우, 회원 정보 삽입
            result = this.userMapper.insertUser(user);
        }

        if (result > 0) {
            return CommonResult.SUCCESS;
        } else {
            return CommonResult.FAILURE;
        }
    }

    public CommonResult updateCorporateIdentification(String identificationNumber, Integer userId) {
        if (userId == null || identificationNumber == null) {
            return CommonResult.FAILURE;
        }

        // 주민번호를 클라이언트와 왕복시키지 않기 위해 userId로 조회한다.
        UserEntity existingUser = this.userMapper.selectUserById(userId);

        if (existingUser == null) {
            return CommonResult.FAILURE;
        }

        // 비회원(unregisterCustomer)인 경우에만 사업자 번호 등록 허용
        if (!"unregisterCustomer".equals(existingUser.getUserType())) {
            return CommonResult.FAILURE;
        }

        UserEntity user = new UserEntity();
        // DB에 저장된 암호화된 주민번호를 업데이트 WHERE 조건으로 그대로 재사용
        user.setResidentNumber(existingUser.getResidentNumber());
        user.setIdentificationNumber(identificationNumber);
        
        int result = this.userMapper.updateUserIdentificationNumber(user);

        if (result > 0) {
            return CommonResult.SUCCESS;
        } else {
            return CommonResult.FAILURE;
        }
    }

    public KioskResult seminRegister(UserEntity user) {
        if (user.getIsTermsAgreed() == null || user.getIsTermsAgreed() != 1) {
            return KioskResult.FAILURE_NOT_AGREED;
        }
        if( user.getResidentNumber() == null || user.getName() == null) {
            return KioskResult.FAILURE;
        }
        // 1. 이미 존재하는 주민번호인지 확인 (블라인드 인덱스로 검색)
        String rrnIndex = AESUtil.blindIndex(user.getResidentNumber());
        String rrnEnc = AESUtil.encrypt(user.getResidentNumber());
        UserEntity existingUser = this.userMapper.selectUserByResidentNumber(rrnIndex);

        if (existingUser != null) {
            // 키오스크(비회원)의 경우, 이미 가입된 내역이 있다면
            // 에러를 띄우지 말고 바로 성공 처리하여 다음 단계로 넘어가게 합니다.
            return KioskResult.FAILURE_EXISTING_RESIDENT_NUMBER;
        }

        // 2. 평문 주민번호에서 성별, 나이 추출
        setGenderAndAgeFromResidentNumber(user);

        // 3. resident_number = 블라인드 인덱스(검색용), resident_number_enc = GCM 암호문(복호화용)
        user.setResidentNumberEnc(rrnEnc);
        user.setResidentNumber(rrnIndex);
        user.setIsTermsAgreed(1);
        int result = this.userMapper.insertUnregisteredUser(user);
        if(result > 0) {
            return KioskResult.SUCCESS;
        }
        else {
            return KioskResult.FAILURE;
        }
    }

    private void setGenderAndAgeFromResidentNumber(UserEntity user) {
        String residentNumber = user.getResidentNumber();
        if (residentNumber == null || residentNumber.length() < 7) {
            return;
        }
        // 1. 하이픈 제거
        residentNumber = residentNumber.replace("-", "");

        if (residentNumber.length() != 13) {
            return;
        }
        // 2. 성별 추출 (7번째 자리)
        char genderCode = residentNumber.charAt(6);
        if (genderCode == '1' || genderCode == '3' || genderCode == '5') {
            user.setGender(Gender.MALE);
        } else if (genderCode == '2' || genderCode == '4' || genderCode == '6') {
            user.setGender(Gender.FEMALE);
        }

        // 3. 나이 추출
        String birthYearPrefix;
        if (genderCode == '1' || genderCode == '2' || genderCode == '5' || genderCode == '6') {
            birthYearPrefix = "19";
        } else {
            birthYearPrefix = "20";
        }

        String birthYearStr = birthYearPrefix + residentNumber.substring(0, 2);
        int birthYear = Integer.parseInt(birthYearStr);
        int currentYear = LocalDate.now().getYear();

        // 현재 연도 - 출생 연도 (만 나이가 아닌 연 나이 기준)
        int age = currentYear - birthYear;
        user.setAge(String.valueOf(age));
    }
    public CommonResult registerMember(MemberEntity member) {
        if (member.getName() == null || member.getEmail() == null || member.getPassword() == null||
                member.getLevel() == null || member.getAuth() == null || member.getTeam() == null ) {
            return CommonResult.FAILURE;
        }
        if (member.getPassword() != null && !member.getPassword().isBlank()) {
            member.setPassword(encoder.encode(member.getPassword()));
        } else {
            member.setPassword(null);
        }
        int result = this.userMapper.insertMember(member);
        if (result > 0) {
            return CommonResult.SUCCESS;
        } else {
            return CommonResult.FAILURE;
        }
    }
    public CommonResult deleteUser( Long id) {
        int result = this.userMapper.deleteMember(id);
        if( result > 0) {
            return CommonResult.SUCCESS;

        } else {
            return CommonResult.FAILURE;
        }
    }

    public CommonResult modifyMember(MemberEntity member) {
        if (member.getEmail() == null) {
            return CommonResult.FAILURE;
        }
        // 비밀번호가 새로 입력된 경우에만 인코딩한다. 비어있으면 null로 두어
        // 매퍼가 password 컬럼을 건드리지 않게 하여 기존 비밀번호를 보존한다.
        // (항상 encode 하면, 수정 폼이 빈 값/기존 해시를 보낼 때 이중 인코딩되어 비밀번호가 깨진다.)
        if (member.getPassword() != null && !member.getPassword().isBlank()) {
            member.setPassword(encoder.encode(member.getPassword()));
        } else {
            member.setPassword(null);
        }
        int result = this.userMapper.updateMember(member);
        if (result > 0) {
            return CommonResult.SUCCESS;
        } else {
            return CommonResult.FAILURE;
        }
    }

    public List<MemberEntity> getMembers() {
        return this.userMapper.selectMembers();
    }

    public UserEntity login(String email, String password) {

        if (email == null || password == null) {
            return null;
        }
        // 1. 이메일로 유저를 먼저 찾는다.
        UserEntity user = this.userMapper.selectUserByEmail(email);

        // 2. 유저가 존재하지 않으면 null 반환
        if (user == null) {
            return null;
        }

        // 3. BCrypt 비밀번호 검증
        if (encoder.matches(password, user.getPassword())) {
            return user;
        }

        return null;
    }

    public CommonResult changePassword(UserEntity user, String oldPassword, String newPassword, String name) {

        if (!UserValidator.validatePassword(newPassword)) {
            return CommonResult.FAILURE;
        }

        UserEntity dbUser = this.userMapper.selectUserByEmail(user.getEmail());
        if (dbUser == null) {
            return CommonResult.FAILURE;
        }

        if (!encoder.matches(oldPassword, dbUser.getPassword())) {
            return CommonResult.FAILURE;
        }

        String newHashedPassword = encoder.encode(newPassword);
        int result;
        if (name != null && !name.trim().isEmpty()) {
            result = this.userMapper.updatePasswordAndName(dbUser.getEmail(), newHashedPassword, name);
            if (result > 0) {
                user.setName(name); // 세션 객체 업데이트
            }
        } else {
            result = this.userMapper.updatePassword(dbUser.getEmail(), newHashedPassword);
        }

        if (result > 0) {
            return CommonResult.SUCCESS;
        } else {
            return CommonResult.FAILURE;
        }
    }

    public UserEntity loginKiosk(String residentNumber ) {
        if (residentNumber == null) {
            return null;
        }
        // 블라인드 인덱스(HMAC)로 DB에서 조회
        String rrnIndex = AESUtil.blindIndex(residentNumber);
        return this.userMapper.selectUserByResidentNumber(rrnIndex);
    }

    public UserEntity loginAdmin(String email, String password) {
        UserEntity admin = this.userMapper.selectUserByEmail(email);
        if (admin == null || !"admin".equals(admin.getUserType())) {
            return null;
        }
        if(BCrypt.checkpw(password,admin.getPassword())) {
            return  admin;
        }
        return null;
    }

    public MemberEntity loginMember(String email, String password) {

        if (email == null || password == null) {
            return null;
        }

        MemberEntity member = this.userMapper.selectMemberByEmail(email);
        if (member != null && encoder.matches(password, member.getPassword())) {
            this.userMapper.updateMemberStatus(email, 1);
            member.setStatus(1);
            return member;
        }
        return null;
    }

    public void setMemberStatus(String email, int status) {
        this.userMapper.updateMemberStatus(email, status);
    }


    @Transactional
    public EmailResult sendVerificationEmail(String email, String type) {
        if (email == null) {
            return EmailResult.FAILURE;
        }
        // 회원가입일 경우에만 중복 이메일 체크
        if ("register".equalsIgnoreCase(type)) {
            if (this.userMapper.selectUserByEmail(email) != null) {
                return EmailResult.FAILURE_DUPLICATE_EMAIL;
            }
        } else if ("password".equalsIgnoreCase(type)) {
             // 비밀번호 변경의 경우, 등록된 유저인지 확인하는 로직을 추가할 수도 있습니다.
             if(this.userMapper.selectUserByEmail(email) == null) return EmailResult.FAILURE;
        }

        String code = RandomStringUtils.randomAlphanumeric(12);

        EmailTokenEntity emailToken = new EmailTokenEntity();
        emailToken.setEmail(email);
        emailToken.setCode(code);
        emailToken.setCreatedAt(LocalDateTime.now());
        emailToken.setExpiresAt(LocalDateTime.now().plusMinutes(3L));

        if (this.userMapper.insertEmailToken(emailToken) == 0) {
            return EmailResult.FAILURE;
        }

        String subject = "[BankScope] 이메일 인증을 완료해주세요.";
        String content = "<div style=\"max-width: 500px; margin: 0 auto; font-family: 'Pretendard Variable', Pretendard, 'Malgun Gothic', sans-serif;\">\n" +
                "    <div style=\"background-color: #20c997; color:#ffffff; font-size: 13pt; font-weight: 600; letter-spacing: 2px; padding: 12px 18px; border-radius: 4px 4px 0 0;\">BankScope</div>\n" +
                "    <div style=\"color: #212121; line-height: 1.5; margin: 20px 0; text-align: justify; word-break: keep-all;\">이메일 인증 요청에 따라 아래 인증번호를 전송하였습니다. 본인이 요청한 게 아니라면 해당 이메일을 안전하게 삭제해 주시고, 절대로 아래 인증번호를 타인에게 알려주어서는 안됩니다.</div>\n" +
                "    <code style=\"background-color: #e6fcf5; color: #0ca678; display: block; font-size: 18pt; padding: 16px 20px; text-align: center; letter-spacing: 8px; margin: 0; user-select: all; font-family: 'Roboto Mono', monospace; font-weight: bold; border-radius: 4px;\">" + code + "</code>\n" +
                "    <div style=\"color: #424242; line-height: 1.5; margin: 16px 0; text-align: justify; font-size: 10pt;\">\n" +
                "        기타 문의 사항은 <a href=\"#\" style=\"color: #20c997; text-decoration: underline;\">고객센터</a>를 통해 남겨주시기 바랍니다. 감사합니다.\n" +
                "    </div>\n" +
                "    <div style=\"margin-top: 24px; border-top: 1px solid #f0f0f0; padding-top: 16px;\">\n" +
                "        <div style=\"color:#9e9e9e; font-size: 9pt; margin-bottom: 4px;\">&copy; " + java.time.Year.now().getValue() + " BankScope. All rights reserved.</div>\n" +
                "        <div style=\"color:#9e9e9e; font-size: 9pt;\">BankScope</div>\n" +
                "    </div>\n" +
                "</div>";

        try {
            MimeMessage message = this.mailSender.createMimeMessage();
            MimeMessageHelper messageHelper = new MimeMessageHelper(message, true, "UTF-8");
            messageHelper.setFrom(mailFrom);
            messageHelper.setTo(email);
            messageHelper.setSubject(subject);
            messageHelper.setText(content, true);
            this.mailSender.send(message);
        } catch (MessagingException e) {
            log.error("[이메일 발송 실패] to={}, type={}, error={}", email, type, e.getMessage());
            return EmailResult.FAILURE;
        }

        return EmailResult.SUCCESS;
    }

    @Transactional
    public EmailResult verifyEmailCode(String email, String code) {
        if (email == null || code == null) {
            return EmailResult.FAILURE;
        }
        EmailTokenEntity emailToken = this.userMapper.selectEmailToken(email, code);

        if (emailToken == null) {
            return EmailResult.FAILURE;
        }
        if (emailToken.isUsed() || emailToken.isVerified()) {
            return EmailResult.FAILURE;
        }
        if (LocalDateTime.now().isAfter(emailToken.getExpiresAt())) {
            return EmailResult.FAILURE_EXPIRED;
        }

        if (this.userMapper.updateEmailTokenAsUsed(emailToken) == 0) {
            return EmailResult.FAILURE;
        }

        return EmailResult.SUCCESS;
    }
    public Pair<CommonResult,UserEntity> getUserInfo( Integer userId) {
        UserEntity dbUser = this.userMapper.selectUserById(userId);
        if( dbUser == null ) {
            return Pair.of(CommonResult.FAILURE, null );
        } else {
            // GCM 암호문(resident_number_enc)을 복호화하여 평문 주민번호로 설정 (이후 컨트롤러에서 마스킹)
            if (dbUser.getResidentNumberEnc() != null) {
                dbUser.setResidentNumber(AESUtil.decrypt(dbUser.getResidentNumberEnc()));
            }
            return Pair.of(CommonResult.SUCCESS, dbUser);
        }
    }
}
