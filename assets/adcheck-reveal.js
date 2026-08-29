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
  var DIST = 40;          // 좌→우 이동 거리(px)
  var DIST_DOWN = 22;     // 위→아래 이동 거리(px)
  var EASE = 'cubic-bezier(.22,1.1,.36,1)'; // 살짝 튀는(쫀득한) 도착

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

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
    el.style.transition = 'opacity .85s ease, transform .95s ' + EASE;
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

  var groupIO, revealIO;

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
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          show(e.target);
          revealIO.unobserve(e.target);
        });
      }, {threshold: 0.06});
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
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      if (el.dataset.dcHidden || el.dataset.dcShown) { revealEls.push(el); return; }
      el.dataset.dcHidden = '1';
      if (!reduce) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity .95s ease, transform .95s cubic-bezier(.2,.8,.2,1)';
      }
      revealEls.push(el);
    });

    // 2단계: 프레임을 하나 넘겨 브라우저가 숨김 상태를 한 번 그리게 한 뒤에야
    // 관찰을 시작하거나 화면 안 항목을 발화한다 — 이 틈이 없으면 opacity:0→1
    // 전환이 같은 틱에서 합쳐져 트랜지션 없이 툭 튀어 보인다("잠깐 움찔").
    requestAnimationFrame(function () {
      staggerGroups.forEach(function (group) {
        if (!hasUnshown(group.querySelectorAll('[data-row]'))) return;
        if (group.getBoundingClientRect().top < innerHeight * 1.2) { fire(group); return; }
        groupIO.observe(group); // 이미 관찰 중이면 스펙상 no-op이라 중복 호출 안전
      });
      revealEls.forEach(function (el) {
        if (el.dataset.dcShown) return;
        revealIO.observe(el);
      });
    });

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
