/* AdCheck reveal motions — 정적 HTML용 (의존성 없음)
 *
 * 사용법
 *   1) 이 파일을 프로젝트에 복사: /public/adcheck-reveal.js
 *   2) </body> 직전에: <script src="/adcheck-reveal.js"></script>
 *   3) 마크업에 속성만 추가:
 *
 *      좌 → 우 (카테고리 진입 시 옆에서 나오는 동작)
 *        <div data-stagger>
 *          <div data-row>...</div>
 *          <div data-row>...</div>
 *        </div>
 *
 *      위 → 아래 (기획안 헬퍼처럼 차르륵)
 *        <div data-stagger="down">
 *          <div data-row>...</div>
 *        </div>
 *
 *      단일 블록 페이드업
 *        <section data-reveal>...</section>
 *
 *   4) 페이지를 SPA처럼 전환한다면 전환 후 window.adcheckReveal() 호출.
 *      (일반 링크 이동 방식이면 아무것도 안 해도 됩니다.)
 */
(function () {
  var STEP = 55;          // 항목 간 시간차(ms)
  var DIST = 40;          // data-row(작은 리스트 행) 좌→우 이동 거리(px)
  var DIST_LEFT_BOX = 64; // data-reveal="left"(큰 박스 단위) 좌→우 이동 거리(px) — 리스트 행보다 크게 움직여야 "부드러운 슬라이드"로 느껴진다
  var DIST_DOWN = 22;     // 위→아래 이동 거리(px)
  var TRANSITION = 'opacity .95s ease, transform .95s cubic-bezier(.2,.8,.2,1)'; // 리스트 캐스케이드부터 박스 등장까지 전부 이 속도로 통일 — 요소 종류별로 제각각이라 "어떤 건 빠르고 어떤 건 느리다"는 피드백을 받음
  var SEQ_STEP = 200;     // data-seq-reveal 페이지에서, 같은 순간 뷰포트에 들어온 섹션들 간 시간차(ms) — 큰 섹션 단위라 130ms로는 순차적으로 느껴지지 않는다는 피드백으로 늘림

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  // <html data-seq-reveal> 를 단 페이지에서만, 한 번에 여러 [data-reveal] 섹션이
  // 뷰포트에 들어와도 동시에 뜨지 않고 순서대로(위→아래 순번) 하나씩 뜨게 한다.
  // 다른 페이지(디자인체크리스트 등)는 기존처럼 동시에 뜬다 — 지정된 페이지에만 옵트인.
  var sequential = document.documentElement.hasAttribute('data-seq-reveal');

  // dcHidden/dcShown은 "컨테이너를 이번에 처리했는지"가 아니라 "이 낱개 요소가
  // 지금 어떤 상태인지"를 기록한다 — 브랜드가이드·매체가이드처럼 같은 컨테이너의
  // innerHTML을 fetch 이후 다시 채우는 페이지에서, 데이터가 오기 전(빈 상태)에
  // 한 번 처리된 컨테이너가 "이미 다뤘음"으로 영구히 표시돼 데이터가 채워진
  // 이후의 진짜 행들이 다시는 관찰·발화되지 않던 문제를 없애기 위함이다.
  function prep(el, dir) {
    if (el.dataset.dcHidden || el.dataset.dcShown) return;
    el.dataset.dcHidden = '1';
    if (reduce) return;
    el.style.opacity = '0';
    el.style.transform = dir === 'down'
      ? 'translateY(-' + DIST_DOWN + 'px)'
      : 'translateX(-' + DIST + 'px)';
    el.style.transition = TRANSITION;
  }

  function show(el) {
    el.dataset.dcShown = '1';
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  function fire(group) {
    var rows = group.querySelectorAll('[data-row]');
    for (var i = 0; i < rows.length; i++) {
      (function (row, i) {
        if (row.dataset.dcShown) return;
        setTimeout(function () { show(row); }, i * STEP);
      })(rows[i], i);
    }
  }

  function hasUnshown(rows) {
    for (var i = 0; i < rows.length; i++) { if (!rows[i].dataset.dcShown) return true; }
    return false;
  }

  var groupIO, revealIO, revealBoxIO;

  function init() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-row],[data-reveal]').forEach(show);
      return;
    }

    if (!groupIO) {
      groupIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          fire(e.target);
          groupIO.unobserve(e.target);
        });
      }, {threshold: 0.01});
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (e) { return e.isIntersecting; });
        visible.forEach(function (e) { revealIO.unobserve(e.target); });
        visible.forEach(function (e, i) {
          if (sequential && i > 0) {
            setTimeout(function () { show(e.target); }, i * SEQ_STEP);
          } else {
            show(e.target);
          }
        });
      }, {threshold: 0.06});
    }
    // 좌→우·위→아래 박스 전용 — 화면 끝에 살짝 걸치자마자 발화되지 않고, 실제로
    // 스크롤해서 눈에 들어와야 등장하게 한다. 처음엔 면적비 threshold(35%)로
    // 했었는데, 로드맵 "사용 중인 기능"처럼 뷰포트보다 훨씬 큰(세로로 긴) 섹션은
    // 자기 높이의 35%가 동시에 화면에 걸치는 순간이 아예 존재하지 않아 영영
    // 나타나지 않는 문제가 있었다. rootMargin으로 "뷰포트 하단에서 조금 위"를
    // 기준선 삼는 방식으로 바꾸면 대상의 크기와 무관하게 항상 도달 가능하다.
    if (!revealBoxIO) {
      revealBoxIO = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (e) { return e.isIntersecting; });
        visible.forEach(function (e) { revealBoxIO.unobserve(e.target); });
        visible.forEach(function (e, i) {
          if (sequential && i > 0) {
            setTimeout(function () { show(e.target); }, i * SEQ_STEP);
          } else {
            show(e.target);
          }
        });
      }, {threshold: 0, rootMargin: '0px 0px -15% 0px'});
    }

    // 1단계: 대상 전부를 먼저 숨김 상태로 만든다 (아직 관찰·발화는 하지 않음).
    // 컨테이너에 아직 [data-row]가 하나도 없으면(fetch 전) 그냥 건너뛴다 —
    // 나중에 콘텐츠가 채워진 뒤 다시 호출될 때 그때 처리하면 된다.
    var staggerGroups = [];
    document.querySelectorAll('[data-stagger]').forEach(function (group) {
      var rows = group.querySelectorAll('[data-row]');
      if (!rows.length) return;
      var dir = group.getAttribute('data-stagger') === 'down' ? 'down' : 'left';
      rows.forEach(function (r) { prep(r, dir); });
      staggerGroups.push(group);
    });
    var revealEls = [];
    var revealBoxEls = [];
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      var isBox = el.getAttribute('data-reveal') === 'left' || el.getAttribute('data-reveal') === 'down';
      var bucket = isBox ? revealBoxEls : revealEls;
      if (el.dataset.dcHidden || el.dataset.dcShown) { bucket.push(el); return; }
      el.dataset.dcHidden = '1';
      if (!reduce) {
        // data-reveal="left"면 좌→우, "down"이면 위→아래(바로 위 data-stagger="down"
        // 리스트와 방향을 맞출 때 씀 — 기획안헬퍼처럼 위 리스트는 위→아래인데 바로
        // 아래 카드가 기본값(아래→위)이면 정반대 방향이 부딪혀 보였다), 값이 없으면
        // 기존처럼 아래→위로. 옵트인한 곳만 바뀌고 나머지(footer 등)는 그대로 둔다.
        var revealDir = el.getAttribute('data-reveal');
        el.style.opacity = '0';
        el.style.transform =
          revealDir === 'left' ? 'translateX(-' + DIST_LEFT_BOX + 'px)' :
          revealDir === 'down' ? 'translateY(-' + DIST_LEFT_BOX + 'px)' :
          'translateY(30px)';
        el.style.transition = TRANSITION;
      }
      bucket.push(el);
    });

    // 2단계: 프레임을 하나 넘겨 브라우저가 숨김 상태를 한 번 그리게 한 뒤에야
    // 관찰을 시작하거나 화면 안 항목을 발화한다 — 이 틈이 없으면 opacity:0→1
    // 전환이 같은 틱에서 합쳐져 트랜지션 없이 툭 튀어 보인다("잠깐 움찔").
    //
    // data-seq-reveal 페이지는 여기에 추가로 260ms를 더 준다 — 안 그러면 이미
    // 뷰포트 안에 있는(스크롤 없이 바로 보이는) 맨 위 섹션들은 페이지가 그려지자마자
    // 거의 동시에 관찰·발화돼서, 사용자가 화면을 보기도 전에 애니메이션이 끝나버려
    // "이 부분은 좌우로 안 움직인다"고 느껴지는 문제가 실측으로 확인됐다. 스크롤로
    // 만나는 아래쪽 요소는 이미 사용자가 지켜보는 타이밍에 발화되니 영향 없다.
    setTimeout(function () {
      requestAnimationFrame(function () {
        // data-seq-reveal 페이지에서는 "이미 화면 안에 있는" 대상(개별 reveal +
        // stagger 그룹)을 종류 상관없이 DOM 순서로 한 줄에 세워 순서대로 발화한다.
        // 원래는 revealIO·groupIO가 서로 다른 관찰자라 독립적으로 즉시 발화돼서,
        // 안내문구(data-reveal) 바로 뒤에 오는 1~5 리스트(data-stagger)가 동시에
        // 나오는 문제가 있었다(기획안헬퍼 사례). 화면 밖(스크롤로 만나는) 대상은
        // 그대로 각자의 관찰자에게 맡긴다 — 스크롤 자체가 이미 시간차를 만들어준다.
        if (sequential) {
          var initialBatch = [];
          revealEls.concat(revealBoxEls).forEach(function (el) {
            if (el.dataset.dcShown) return;
            var top = el.getBoundingClientRect().top;
            if (top < innerHeight * 1.15) initialBatch.push({el: el, top: top, kind: 'el'});
          });
          staggerGroups.forEach(function (group) {
            if (!hasUnshown(group.querySelectorAll('[data-row]'))) return;
            var top = group.getBoundingClientRect().top;
            if (top < innerHeight * 1.2) initialBatch.push({el: group, top: top, kind: 'group'});
          });
          initialBatch.sort(function (a, b) { return a.top - b.top; });
          initialBatch.forEach(function (item, i) {
            item.el.dataset.dcQueued = '1'; // 아래 개별 관찰자 등록에서 중복 발화되지 않게 표시
            setTimeout(function () {
              if (item.kind === 'group') fire(item.el); else show(item.el);
            }, i * SEQ_STEP);
          });
        }

        staggerGroups.forEach(function (group) {
          if (group.dataset.dcQueued) return;
          if (!hasUnshown(group.querySelectorAll('[data-row]'))) return;
          if (!sequential && group.getBoundingClientRect().top < innerHeight * 1.2) { fire(group); return; }
          groupIO.observe(group); // 이미 관찰 중이면 스펙상 no-op이라 중복 호출 안전
        });
        revealEls.forEach(function (el) {
          if (el.dataset.dcShown || el.dataset.dcQueued) return;
          revealIO.observe(el);
        });
        revealBoxEls.forEach(function (el) {
          if (el.dataset.dcShown || el.dataset.dcQueued) return;
          revealBoxIO.observe(el);
        });
      });
    }, sequential ? 260 : 0);

    // IntersectionObserver를 지원하는 브라우저에서는 관찰에 맡긴다.
    // (미지원 브라우저는 위에서 이미 즉시 전부 표시 처리함)
  }

  window.adcheckReveal = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
