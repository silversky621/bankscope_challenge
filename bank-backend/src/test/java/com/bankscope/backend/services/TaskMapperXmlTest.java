package com.bankscope.backend.services;

import com.bankscope.backend.entities.TaskEntity;
import com.bankscope.backend.mappers.TaskMapper;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import java.io.InputStream;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class TaskMapperXmlTest {
    @Test void mapperParsesAndTransferKeepsImmutableReceptionFields() throws Exception {
        Configuration config = new Configuration();
        try (InputStream input = getClass().getResourceAsStream("/mappers/TaskMapper.xml")) {
            assertNotNull(input);
            new XMLMapperBuilder(input, config, "mappers/TaskMapper.xml", config.getSqlFragments()).parse();
        }
        for (var method : TaskMapper.class.getDeclaredMethods())
            assertTrue(config.hasStatement(TaskMapper.class.getName() + "." + method.getName()), method.getName());
        String sql = config.getMappedStatement(TaskMapper.class.getName() + ".transferTask")
                .getBoundSql(Map.of("task", new TaskEntity())).getSql();
        assertFalse(sql.contains("ticket_number ="));
        assertFalse(sql.contains("created_at ="));
        assertFalse(sql.contains("feature_snapshot ="));
        assertTrue(sql.contains("predicted_task_detail_type = COALESCE(predicted_task_detail_type,"));
        assertTrue(sql.contains("transfer_count = transfer_count + 1"));
    }
}
