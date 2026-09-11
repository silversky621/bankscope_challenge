package com.bankscope.backend.mappers;


import com.bankscope.backend.entities.BoardEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface BoardMapper {
    int insert(@Param("board") BoardEntity board);
    BoardEntity selectById(@Param("boardId") Integer boardId);
    int update(@Param("board") BoardEntity board);
    int delete(@Param("boardId") Integer boardId);
    
    int selectCountByBoardType(@Param("boardType") String boardType);
    List<BoardEntity> selectArticlesByBoardType(@Param("boardType") String boardType, 
                                                @Param("limit") int limit, 
                                                @Param("offset") int offset);
    List<BoardEntity> selectFourArticlesByBoardType(@Param("boardType") String boardType);
}
