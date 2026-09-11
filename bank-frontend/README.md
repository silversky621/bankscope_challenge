# BankScope Frontend (React + Vite)

이 프로젝트는 React와 Vite를 사용하여 구축된 BankScope 애플리케이션의 프론트엔드 환경입니다.

## 시작하기 전에 (Prerequisites)

이 프로젝트를 로컬 환경에서 실행하려면 아래의 소프트웨어가 설치되어 있어야 합니다.

- **Node.js**: 버전을 확인하고 필요하다면 설치해 주세요. (LTS 버전 권장, 예: v18 이상)
  - [Node.js 다운로드](https://nodejs.org/ko/)
- **npm** (Node.js 설치 시 함께 설치됩니다) 또는 **yarn** / **pnpm**

## 프로젝트 설정 및 실행 방법

### 1. 패키지 설치
프로젝트 루트 디렉토리(이 README.md 파일이 있는 위치)에서 터미널을 열고 다음 명령어를 입력하여 필요한 라이브러리들을 설치합니다.

```bash
# npm을 사용하는 경우
npm install

# yarn을 사용하는 경우
yarn install
```

### 2. React Router 설치
이 프로젝트는 페이지 간의 이동(라우팅)을 관리하기 위해 **React Router**를 사용합니다. 다음 명령어로 설치해주세요.

```bash
# npm을 사용하는 경우
npm install react-router-dom

# yarn을 사용하는 경우
yarn add react-router-dom
```

### 3. 개발 서버 실행
설치가 완료되면 다음 명령어를 통해 개발용 서버를 실행할 수 있습니다.

```bash
# npm을 사용하는 경우
npm run dev

# yarn을 사용하는 경우
yarn dev
```

서버가 성공적으로 실행되면 터미널에 로컬 접속 주소(예: `http://localhost:5173/`)가 표시됩니다.
해당 주소를 브라우저에 입력하여 개발 화면을 확인할 수 있습니다.
(소스 코드를 수정하면 화면에 즉시 반영되는 HMR(Hot Module Replacement)이 기본적으로 적용되어 있습니다.)


---

## 사용된 주요 기술
* **프레임워크**: [React](https://reactjs.org/)
* **빌드 툴**: [Vite](https://vitejs.dev/)
* **라우팅**: [React Router](https://reactrouter.com/)
