package com.bankscope.backend.valitators;

import com.bankscope.backend.entities.UserEntity;
import lombok.NonNull;

public class UserValidator {
    public static final String EMAIL_REGEX = "^(?=.{8,50}$)([\\da-zA-Z_.]{4,25})@([\\da-z\\-]+\\.)?([\\da-z\\-]{2,})\\.([a-z]{2,15}\\.)?([a-z]{2,3})$";
    public static final String PASSWORD_REGEX = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[`~!@#$%^&*()\\-_=+\\[{\\]}\\\\|;:'\",<.>\\/?]).{8,50}$";
    public static final String RESIDENT_NUMBER_REGEX = "/^\\d{6}-[1-4]\\d{6}$/";


    /*public static boolean validateEmail(@NonNull UserEntity user) {
        return validateEmail(user.getEmail());
    }
    public static boolean validateEmail(String email) {
        return email !=null &&
                ValidatorUtils.isLengthInBetween(email, 8, 50) && email.matches(EMAIL_REGEX);
    }*/
    public static boolean validatePassword(@NonNull UserEntity user) {
        return validatePassword(user.getPassword());
    }
    public static boolean validatePassword(String password) {
        return password !=null &&
                ValidatorUtils.isLengthInBetween(password, 8, 50) && password.matches(PASSWORD_REGEX);
    }

    public static boolean validateResidentNumber(@NonNull UserEntity user) {
        return validateResidentNumber(user.getResidentNumber());
    }
    public static boolean validateResidentNumber(String residentNumber) {
        return residentNumber != null && residentNumber.matches(RESIDENT_NUMBER_REGEX);
    }


}