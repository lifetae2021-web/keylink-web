# 키링 월드 캐릭터(아바타) 설계서

Blender에서 만든 캐릭터를 GLB로 내보내고, 웹(three.js)이 불러와 사람마다 다르게 꾸민다.
그림체는 두 가지이고, 입장할 때 고른다.

| 그림체 | id | 키 | 등신 | 느낌 |
|---|---|---|---|---|
| 귀여운 | `chibi` | 약 1.8m | 2.5등신 | 둥글둥글, 큰 머리. 지금 맵과 같은 로우폴리 계열 |
| 세미리얼 | `semi` | 약 1.8m | 6등신 | 성인 비율, 단순화한 얼굴 |

## 장면 구성(Blender)

- 마을과 섞이지 않게 별도 장면 `KL_Avatar`에서 작업한다. 마을 내보내기(VILLAGE_*)에는 들어가지 않는다.
- 그림체마다 컬렉션 `AVATAR_chibi`, `AVATAR_semi`를 두고, 각각 `avatar_chibi.glb`, `avatar_semi.glb`로 내보낸다.
- 단위는 미터, Z-up이다. 캐릭터는 Blender에서 -Y를 바라본다(웹에서는 +Z를 바라봄).

## 뼈대(두 그림체가 같은 이름을 쓴다)

`root › hips › spine › chest › neck › head`
`chest › upper_arm.L/R › lower_arm.L/R › hand.L/R`
`hips › upper_leg.L/R › lower_leg.L/R › foot.L/R`

애니메이션은 회전 위주로 만든다(hips만 위치를 움직임). 그래야 두 그림체가 같은 동작을 쓸 수 있다.

## 부위(모듈식 캐릭터)

모든 부위는 한 GLB에 들어 있고, 웹은 고른 것만 보이게 한다. 색은 웹에서 재질 색으로 바꾼다.

- **몸 `BODY`**: 피부색 재질. 셰이프 키는 `build_slim`, `build_broad`(체형), `female`(실루엣)이다.
- **머리 `HEAD`**: 얼굴은 텍스처다. 웹이 캔버스에 피부색, 눈, 눈썹, 입, 볼터치를 그려서 입힌다. 그래서 눈 크기, 간격, 높이, 모양, 색과 눈썹, 입 같은 슬라이더 값을 메시를 고치지 않고 바꿀 수 있다. 셰이프 키는 `face_long`, `face_vline`, `cheek_full`이다.
- **헤어 `HAIR_*`**: head 뼈에 붙인다. 짧은머리, 댄디, 투블럭, 삐죽, 단발, 긴머리, 포니테일, 번이 있다.
- **상의 `TOP_*`**: 몸 표면을 복제하고 살짝 부풀려서 몸과 같은 가중치로 함께 움직이게 한다. 반팔, 긴팔, 후드, 셔츠, 원피스(상의+치마)가 있다.
- **하의 `BOTTOM_*`**: 긴바지, 반바지, 치마가 있다.
- **신발 `SHOES_*`**: 운동화, 부츠가 있다.
- **액세서리 `ACC_*`**: 안경, 캡모자, 비니, 귀걸이, 크로스백이 있다.

## 애니메이션(glTF 애니메이션 → 웹 AnimationMixer)

`idle`(숨쉬기), `walk`(걷기, 1초 루프), `wave`(인사), `sit`(둘만의 자리에 앉기용)이 있다.

## 웹 데이터(`look` v2)

```
{ v:2, style:'chibi'|'semi', skin:'#hex', height:-1~1, build:-1~1, female:0~1,
  face:{ long, vline, cheek }, eye:{ type, size, gap, y, color }, brow:{ type, thick }, mouth:{ type }, blush:0~1,
  hair:{ type, color }, top:{ type, color }, bottom:{ type, color }, shoes:{ type, color }, acc:[type...] }
```

- 숫자는 범위로 자르고, type은 허용 목록만, 색은 `#rrggbb`만 받는다. 서버(가입 API, 워커 둘 다)에서 검사한다.
- 예전 `look` v1(face/hair/hairColor/eye/clothes)은 v2로 바꿔서 읽는다. 이미 만든 캐릭터는 그대로 이어진다.

## 단계

1. chibi 몸: 뼈대, 가중치, 얼굴 UV, 셰이프 키, idle/walk. 렌더로 확인한다.
2. chibi 부위: 헤어, 의상, 신발, 액세서리.
3. 웹: 배그식 편집 화면(전체 화면, 회전, 탭, 슬라이더), look v2, 서버 검사, 다른 사람에게 동기화, 애니메이션.
4. semi 그림체: 같은 뼈 이름으로 만든다.
5. 마무리: 성능(휴대폰), 키키 NPC, 배포.
