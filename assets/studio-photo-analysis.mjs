/* 분류 API와 기획기 사이의 계약. 미분류를 인물 없음으로 확정하지 않는다. */
const FIELDS = ['matchesTarget','assetKind','role', 'hasPerson', 'personKind', 'plainBg', 'shotAngle',
  'shotDistance', 'itemCount', 'isHero', 'isGift', 'colorway', 'burnedText', 'note', 'regions'];

export function selectClassificationPhotos(photos, limit = 6) {
  const unique = [...new Map(photos.filter(p => p?.url).map(p => [p.url, p])).values()];
  const count = Math.max(0, Math.floor(limit));
  if (!count) return [];
  if (unique.length <= count) return unique;
  if (count === 1) return [unique[0]];
  // 대표컷부터 마지막 상세컷까지 포함한다. 중복 URL은 자리를 차지하지 않는다.
  return Array.from({length: count}, (_, i) => unique[Math.round(i * (unique.length - 1) / (count - 1))]);
}

export function applyPhotoClassification(photo, row) {
  if (!row) return false;
  for (const key of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) photo[key] = row[key];
  }
  return true;
}
