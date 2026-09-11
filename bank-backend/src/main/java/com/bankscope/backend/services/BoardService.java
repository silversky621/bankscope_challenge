package com.bankscope.backend.services;

import com.bankscope.backend.entities.BoardEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.mappers.BoardMapper;
import com.bankscope.backend.results.BoardResult;
import com.bankscope.backend.vos.BoardPageVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BoardService {
    private final BoardMapper boardMapper;

    public BoardResult write(BoardEntity board, UserEntity user) {
        if (!isAdmin(user)) {
            return BoardResult.FAILURE;
        }
        if (!isValidBoard(board)) {
            return board != null && board.getBoardType() != null
                    ? BoardResult.FAILURE_INVALIDATE_BOARD_TYPE
                    : BoardResult.FAILURE;
        }

        board.setUserId(user.getId());
        board.setCreatedAt(LocalDateTime.now());
        board.setUpdatedAt(LocalDateTime.now());
        return this.boardMapper.insert(board) > 0 ? BoardResult.SUCCESS : BoardResult.FAILURE;
    }

    public BoardResult modify(BoardEntity board, UserEntity user) {
        if (!isAdmin(user) || board == null || board.getBoardId() == null || board.getBoardId() < 1) {
            return BoardResult.FAILURE;
        }

        BoardEntity dbBoard = this.boardMapper.selectById(board.getBoardId());
        if (dbBoard == null) {
            return BoardResult.FAILURE;
        }
        if (board.getTitle() != null) {
            dbBoard.setTitle(board.getTitle());
        }
        if (board.getContent() != null) {
            dbBoard.setContent(board.getContent());
        }
        dbBoard.setUpdatedAt(LocalDateTime.now());
        return this.boardMapper.update(dbBoard) > 0 ? BoardResult.SUCCESS : BoardResult.FAILURE;
    }

    public BoardResult delete(Integer boardId, UserEntity user) {
        if (!isAdmin(user) || boardId == null || boardId < 1) {
            return BoardResult.FAILURE;
        }
        if (this.boardMapper.selectById(boardId) == null) {
            return BoardResult.FAILURE;
        }
        return this.boardMapper.delete(boardId) > 0 ? BoardResult.SUCCESS : BoardResult.FAILURE;
    }

    public BoardEntity getArticleByBoardId(Integer boardId) {
        if (boardId == null || boardId < 1) {
            return null;
        }
        BoardEntity board = this.boardMapper.selectById(boardId);
        if (board != null) {
            board.setViewCount(board.getViewCount() + 1);
            this.boardMapper.update(board);
        }
        return board;
    }

    public Pair<BoardPageVo, List<BoardEntity>> getList(String boardType, int requestPage) {
        if (!isSupportedBoardType(boardType)) {
            return null;
        }

        int totalCount = this.boardMapper.selectCountByBoardType(boardType);
        BoardPageVo pageVo = new BoardPageVo(requestPage, totalCount);
        List<BoardEntity> articles = this.boardMapper.selectArticlesByBoardType(
                boardType,
                pageVo.getRowCount(),
                pageVo.getDbOffset());
        return Pair.of(pageVo, articles);
    }

    public List<BoardEntity> getFourArticles(String boardType) {
        if (!isSupportedBoardType(boardType)) {
            return null;
        }
        return this.boardMapper.selectFourArticlesByBoardType(boardType);
    }

    private boolean isValidBoard(BoardEntity board) {
        return board != null
                && isSupportedBoardType(board.getBoardType())
                && board.getTitle() != null
                && board.getContent() != null;
    }

    private boolean isSupportedBoardType(String boardType) {
        return "notice".equals(boardType) || "event".equals(boardType);
    }

    private boolean isAdmin(UserEntity user) {
        return user != null && "admin".equals(user.getUserType());
    }
}
