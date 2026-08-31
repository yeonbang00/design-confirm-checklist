// 푸터 구간에서 GNB 숨기기
//
// 한동안 이 기능을 없애뒀었다. 그때는 푸터에 로고와 면책 문구뿐이라 GNB가
// 떠 있어도 겹칠 게 없었고, 오히려 사라지는 쪽이 거슬렸기 때문이다.
// 지금은 푸터에 사이트맵 링크가 들어가서 GNB와 같은 항목이 두 번 보인다.
// 그래서 푸터가 상단 내비 위치까지 올라오면 GNB를 감춘다.
(function () {
  var NAV_BOTTOM = 62;   // GNB 알약의 아래 경계(px) — on-light 판정과 같은 기준
  var gnb = document.querySelector('.gnb-bar');
  var footer = document.querySelector('.page-footer');
  if (!gnb || !footer) return;

  var raf = null;
  function update() {
    raf = null;
    gnb.classList.toggle('is-hidden', footer.getBoundingClientRect().top < NAV_BOTTOM);
  }
  function onScroll() {
    if (raf === null) raf = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
