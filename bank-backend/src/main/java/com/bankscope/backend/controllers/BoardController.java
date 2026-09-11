package com.bankscope.backend.controllers;


import com.bankscope.backend.entities.BoardEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.results.BoardResult;
import com.bankscope.backend.results.CommonResult;
import com.bankscope.backend.services.BoardService;
import com.bankscope.backend.vos.BoardPageVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "게시판(Board)", description = "게시판 관련 API")
@RestController
@RequestMapping(value = "/api/board")
@RequiredArgsConstructor
public class BoardController {
    // 게시물 작성
    // 게시물 수정
    // 게시물 삭제
    // 게시물 가져오기
    // 게시물 목록 가져오기
     // -> 공지사항인지 이벤트 인지 구분해서
    private final BoardService boardService;

    @Operation(summary = "게시글 작성", description = "최고관리자의 세션정보와 작성 폼데이터 정보를 받아 게시글을 작성합니다. boardType은 반드시 event나 notice여야 합니다." )
    @RequestMapping(value = "/", method = RequestMethod.POST,produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String , Object> postArticle(BoardEntity board, HttpSession session) {
            Map<String , Object> response = new HashMap<>();
            UserEntity user = (UserEntity) session.getAttribute("user");
            BoardResult result = this.boardService.write(board, user);
            response.put("result", result);
            return response;
    }
    @Operation(summary = "게시글 수정", description = "최고관리자의 세션정보와 게시글 id 및 수정내용(제목,내용)을 폼데이터로 보내어 게시글 수정합니다." )
    @RequestMapping(value = "/", method = RequestMethod.PATCH, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String,Object> patchArtice(BoardEntity board, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        BoardResult result = this.boardService.modify(board, user);
        response.put("result", result);
        return response;
    }
    @Operation(summary = "게시글 삭제", description = "게시글 ID를 전달받아 게시글을 삭제합니다.")
    @RequestMapping(value = "/", method = RequestMethod.DELETE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> deleteArticle(@RequestParam(value = "boardId") Integer boardId, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        UserEntity user = (UserEntity) session.getAttribute("user");
        BoardResult result = this.boardService.delete(boardId, user);
        response.put("result", result);
        return response;   
    }
    
    @Operation(summary = "단일 게시글 조회", description = "게시글 ID를 전달받아 특정 게시글의 상세 정보를 조회합니다. GET /api/board/?boardId=1 형태로 요청하면됨")
    @RequestMapping(value = "/", method = RequestMethod.GET , produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getArticle(@RequestParam(value = "boardId") Integer boardId) {
        Map<String, Object> response = new HashMap<>();
        BoardEntity board = this.boardService.getArticleByBoardId(boardId);
        
        if (board != null) {
            response.put("result", CommonResult.SUCCESS.name());
            response.put("article", board);
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }

    @Operation(summary = "게시글 목록 조회", description = "게시판 타입(notice, event)과 페이지 번호를 전달받아 게시글 목록을 조회합니다. GET /api/board/list?boardType=notice&page=1과 같이 호출하면 됩니다.")
    @RequestMapping(value = "/list", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Map<String, Object> getList(
            @RequestParam(value = "boardType", required = true) String boardType,
            @RequestParam(value = "page", required = false, defaultValue = "1") int requestPage) {
        
        Map<String, Object> response = new HashMap<>();
        Pair<BoardPageVo, List<BoardEntity>> pair = this.boardService.getList(boardType, requestPage);
        
        if (pair != null) {
            response.put("result", CommonResult.SUCCESS.name());
            response.put("pageVo", pair.getLeft());
            response.put("articles", pair.getRight());
        } else {
            response.put("result", CommonResult.FAILURE.name());
        }
        return response;
    }
    @RequestMapping(value = "/articles", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public List<BoardEntity> getArticles(@RequestParam(value = "boardType") String boardType) {
        return this.boardService.getFourArticles(boardType);
    }
    //새소식 최신순으로 4개 제목과 작성일자 받아오는 api필요
    //이벤트도 마찬가지
}