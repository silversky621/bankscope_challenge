package com.bankscope.backend.controllers;

import com.bankscope.backend.services.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

/** Public lobby display: ticket and counter only, no customer or task details. */
@RestController
@RequiredArgsConstructor
public class QueueDisplayController {
    private final TaskService taskService;

    @GetMapping("/api/queue/display")
    public ResponseEntity<List<Map<String, Object>>> display() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(taskService.getQueueDisplay());
    }
}
