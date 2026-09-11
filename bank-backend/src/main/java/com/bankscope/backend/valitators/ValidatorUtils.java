package com.bankscope.backend.valitators;

import lombok.NonNull;
import lombok.experimental.UtilityClass;

@UtilityClass
public class ValidatorUtils {
    // default 접근제한자 : 패키지가 같은 애들끼리만 쓸수있음
    static boolean isLengthInBetween (@NonNull String str,
                                      int min,
                                      int max) {
        return str.length() >= min && str.length() <= max;
    }
}
