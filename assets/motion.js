// 공용 등장 모션 — 클로드 디자인 v4 시안의 모션 규칙을 그대로 옮긴 것.
//
//   [data-reveal]                 화면에 들어오면 아래에서 위로 떠오르며 페이드인
//   [data-stagger] > [data-row]   컨테이너가 보이면 자식 행이 52ms 간격으로 차르륵
//
// 시안과 동일하게 1.4초 폴백을 둬서, IntersectionObserver가 못 도는 환경이나
// 관찰 대상이 끝내 화면에 안 들어오는 경우에도 콘텐츠가 숨은 채로 남지 않게 한다.
// 스크립트가 아예 실행되지 않을 때를 대비해, 초기 opacity:0은 CSS가 아니라
// 이 스크립트가 붙이는 html.motion-ready 클래스에만 걸려 있다(점진적 향상).
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('motion-ready');

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var show = function (el) { el.classList.add('in'); };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.06 });

    var fire = function (el) {
      el.querySelectorAll('[data-row]').forEach(function (r, i) {
        setTimeout(function () { r.classList.add('in'); }, i * 52);
      });
    };

    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        fire(e.target);
        sio.unobserve(e.target);
      });
    }, { threshold: 0.01 });

    function bind() {
      document.querySelectorAll('[data-reveal]').forEach(function (n) {
        if (n.dataset.rBound) return;
        n.dataset.rBound = '1';
        io.observe(n);
      });
      document.querySelectorAll('[data-stagger]').forEach(function (n) {
        if (n.dataset.sBound) return;
        n.dataset.sBound = '1';
        // 이미 첫 화면에 들어와 있으면 관찰을 기다리지 않고 바로 실행
        if (n.getBoundingClientRect().top < window.innerHeight * 1.2) { fire(n); return; }
        sio.observe(n);
      });
    }

    bind();

    // 분석 결과처럼 나중에 DOM에 꽂히는 요소도 자동으로 잡아준다
    window.acBindMotion = bind;
    new MutationObserver(function () { bind(); })
      .observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      document.querySelectorAll('[data-reveal],[data-row]').forEach(show);
    }, 1400);
  });
})();
