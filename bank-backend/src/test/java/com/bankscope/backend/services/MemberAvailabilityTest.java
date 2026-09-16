package com.bankscope.backend.services;

import com.bankscope.backend.entities.MemberEntity;
import com.bankscope.backend.mappers.TaskMapper;
import com.bankscope.backend.mappers.UserMapper;
import com.bankscope.backend.results.CommonResult;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberAvailabilityTest {
    @Test void cannotGoAwayWhileCounterHasAnActiveCustomer() {
        var tasks = mock(TaskMapper.class);
        var users = mock(UserMapper.class);
        var member = MemberEntity.builder().id(1L).status(1).counterNumber(1).build();
        when(tasks.selectOtherActiveTaskForUpdate(1, -1L)).thenReturn(42L);
        var service = new MemberService(tasks, users);
        assertEquals(CommonResult.FAILURE_NOT_ALLOWED, service.patchMemberStatus(member, false));
        assertEquals(1, member.getStatus());
        verifyNoInteractions(users);
    }

    @Test void idleCounterCanGoAwayAndReturn() {
        var tasks = mock(TaskMapper.class);
        var users = mock(UserMapper.class);
        var member = MemberEntity.builder().id(1L).status(1).counterNumber(1).build();
        when(tasks.selectOtherActiveTaskForUpdate(1, -1L)).thenReturn(null);
        when(users.updateMember(member)).thenReturn(1);
        var service = new MemberService(tasks, users);
        assertEquals(CommonResult.SUCCESS, service.patchMemberStatus(member, false));
        assertEquals(0, member.getStatus());
        assertEquals(CommonResult.SUCCESS, service.patchMemberStatus(member, true));
        assertEquals(1, member.getStatus());
    }
}
