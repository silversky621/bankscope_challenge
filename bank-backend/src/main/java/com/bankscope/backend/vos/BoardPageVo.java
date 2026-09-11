package com.bankscope.backend.vos;

import lombok.Getter;

@Getter
public class BoardPageVo {

    private final  int rowCount = 5;  // 한페이지에 표시할 게시글의 개수
    private final  int anchorCount = 5; // 표시할 페이지 앵커의 개수( ex 1~10, 11~20, 21~30)
    private final  int minPage = 1; //  존재하는 최소 페이지번호
    private final int maxPage ;     // 존재하는 최대 페이지번호
    private final int startPage;    // 표시할 최소 앵커 번호
    private final int endPage;     // 표시할 최대 앵커 번호
    private final  int totalCount;   // 전체 게시글 개수
    private final int requestPage;   // 사용자가 요청한 페이지 번호
    private final int dbOffset;    // 쿼리 OFFSET

    public BoardPageVo(int requestPage, int totalCount) {
        this.requestPage = requestPage;
        this.totalCount = totalCount;
        this.maxPage = totalCount == 0 ? 1 : totalCount / this.rowCount + (totalCount % this.rowCount == 0 ? 0 : 1 );
        this.startPage = (requestPage / this.anchorCount ) * this.anchorCount  + 1;
        this.endPage = Math.min( this.maxPage, this.startPage + (this.anchorCount -1) );
        this.dbOffset = (this.requestPage - 1) * this.rowCount;
    }
}
