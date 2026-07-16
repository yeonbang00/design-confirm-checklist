// Reference "성과 좋았던" banners, grouped by "집중비교" category.
//
// HOW TO ADD REFERENCE IMAGES TO A CATEGORY:
// Send the images to Claude in chat and say which category they belong to
// (e.g. "브랜드 A 기준 배너로 추가해줘"). Claude will give you an updated
// version of this file to paste into GitHub (same workflow as the
// analyze.js fixes). You don't need to hand-encode base64 yourself.
//
// Categories with an empty `images` array still show up in the dropdown
// (so the team can see what's available), but won't produce a comparison
// until at least one image is added.
//
// Structure:
// ADVERTISERS = {
//   '<url-safe-id>': {
//     name: '<드롭다운에 표시할 이름>',
//     note: '<선택 메모>',
//     images: [
//       { mimeType: 'image/jpeg', data: '<BASE64>' },
//       ...
//     ],
//   },
// }

export const ADVERTISERS = {
  'brand-a': {
    name: '브랜드 A',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  },
  'brand-b': {
    name: '브랜드 B',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  },
  'brand-c': {
    name: '브랜드 C',
    note: '아직 기준 배너가 등록되지 않았습니다.',
    images: [],
  },
};
