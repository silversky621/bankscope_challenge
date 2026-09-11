package com.bankscope.backend.mappers;

import com.bankscope.backend.entities.CorporateManagementEntity;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface CorporateManageMapper {
    List<CorporateManagementEntity> selectAll();
    CorporateManagementEntity selectById(int id);
    void insert(CorporateManagementEntity corporateManage);
    void update(CorporateManagementEntity corporateManage);
    void delete(int id);
}
