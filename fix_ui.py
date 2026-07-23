import re

with open('src/app/apply/fast/ClientPage.tsx', 'r') as f:
    client_content = f.read()

# 1. Change the accordion button to just open the modal.
# The button currently looks like:
#           <button
#             type="button"
#             onClick={() => setShowGuide(!showGuide)}
# ...
#             <ChevronDown size={18} color="#FF6F61" style={{ transform: showGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
#           </button>

button_start = client_content.find('{/* ─── Guide Accordion ─── */}')
if button_start != -1:
    button_end = client_content.find('</button>', button_start) + len('</button>')
    div_end = client_content.find('</div>\n        </div>', button_end) + len('</div>\n        </div>')
    
    new_button_code = '''{/* ─── Guide Accordion (Modal Trigger) ─── */}
        <div style={{ margin: '20px 0 16px 0' }}>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            style={{
              width: '100%',
              background: '#FFF5F4',
              border: '1px solid #FFE8E5',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(255,111,97,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#FF6F61', letterSpacing: '-0.02em' }}>
                "내가 답답해서 직접 만들었다!" 키링크 필수 안내 및 특별 혜택 보기
              </span>
            </div>
            <ChevronRight size={18} color="#FF6F61" />
          </button>
        </div>'''
    
    client_content = client_content[:button_start] + new_button_code + client_content[div_end:]

# 2. Add the modal at the end before </div>\n  );\n}
modal_code = '''
      {/* ─── Guide Modal ─── */}
      {showGuide && (
        <div 
          onClick={() => setShowGuide(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative' }}
          >
            <button onClick={() => setShowGuide(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="#999" />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', marginBottom: '16px', paddingRight: '30px' }}>
              키링크 필수 안내 및 특별 혜택
            </h2>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.7', color: '#444' }}>
              <p style={{ marginBottom: '16px', fontWeight: '600', color: '#333' }}>
                로테이션 소개팅, 파티, 소모임 등 수없이 참여해보고 "내가 만들어도 이것보단 잘 만들겠다!"라는 생각이 들어 만든 '키링크'입니다.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[기본 정보]</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>인원:</strong> 6:6 ~ 8:8 (노쇼가 없는 한 성비는 1:1 원칙)</li>
                  <li><strong>장소:</strong> 부산 서면 인근 프라이빗 파티룸 (정확한 장소 별도 공지)</li>
                  <li><strong>날짜:</strong> 매주 금, 토, 일, 공휴일</li>
                  <li><strong>시간:</strong> 약 2시간 소요</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[참가 조건]</p>
                <p style={{ marginBottom: '6px', fontWeight: '600' }}>부산, 울산, 경남 등에 거주하는 미혼 남녀</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>남성:</strong> 무직 참석 불가(의대, 법대 등은 가능), 키 173cm 이상(자기관리 우수자는 이하여도 가능)</li>
                  <li><strong>여성:</strong> 나이 무관, 무직 가능하나 자기관리를 하시는 분, 키 150cm 이상</li>
                  <li>비슷한 나이, 이상형에 부합하는 연령대로 구성</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[비용 안내] <span style={{ color: '#FF6F61', fontSize: '0.8rem' }}>(이번 달 특별 인하가)</span></p>
                
                <p style={{ fontWeight: '700', marginBottom: '4px', color: '#555' }}>남성 참가 비용</p>
                <ul style={{ paddingLeft: '16px', margin: '0 0 10px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <li>일반 신청: 49,000원</li>
                  <li>안심 매칭 패키지 (매칭 실패 시 30% 환불 보장): 60,000원</li>
                </ul>

                <p style={{ fontWeight: '700', marginBottom: '4px', color: '#555' }}>여성 참가 비용</p>
                <ul style={{ paddingLeft: '16px', margin: '0 0 10px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <li>일반 신청: 29,000원</li>
                  <li>동반 신청 (지인과 함께 신청 시): 19,000원 (1만 원 할인 적용)</li>
                </ul>
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>* 대관료, 음료, 다과 및 각종 혜택 비용이 모두 포함되어 있습니다.</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[진행 방식]</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>선발 및 확정:</strong> 신청 후 선발된 분들께 개별 문자 발송 (입금 확인 시 최종 확정)</li>
                  <li><strong>본인 확인:</strong> 행사 당일 신분증 지참 필수, 철저한 신원 확인 후 입장</li>
                  <li><strong>1:1 로테이션 대화:</strong> 모든 이성과 약 15분씩 집중 대화 진행</li>
                  <li><strong>매칭 및 결과:</strong> 행사 종료 후 호감 가는 이성 3명 선택, 상호 호감 시 오픈채팅방 연결</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[키링크만의 차별화 보장]</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>중복 만남 100% 환불:</strong> 예전에 만났던 사람과 같은 기수에서 만나면 100% 환불 처리</li>
                  <li><strong>안심 매칭 보장:</strong> 남성 안심 패키지 선택 후 매칭 실패 시 30% 환불</li>
                  <li><strong>맞춤 큐레이션:</strong> 남녀 간의 이상형과 연령대를 세밀하게 참고하여 최적의 조합 구성</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[성공 매칭 특별 혜택]</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>현실 커플 인증 시:</strong> 치킨 기프티콘 발송 및 추후 재참여 시 50% 할인 (A/S 지원)</li>
                  <li><strong>결혼 골인 시:</strong> 축의금 15만 원 지원 및 9년 차 전문 사회자 무료 섭외</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[필수 유의 사항]</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>참가 자격:</strong> 현재 법적 미혼이며 교제 중인 이성이 없는 분 (허위 사실 적발 시 영구 정지 및 법적 책임)</li>
                  <li><strong>취소 정책:</strong> 참여 확정(결제 완료) 이후 단순 변심이나 개인 일정 변경에 의한 환불은 원칙적으로 불가</li>
                </ul>
              </div>

              <div>
                <p style={{ fontWeight: '800', color: '#111', marginBottom: '8px', fontSize: '0.9rem' }}>[안내 사항]</p>
                <p>
                  지원자가 많아 매주 월요일부터 순차적으로 선정된 분들에 한해서만 개별 카톡을 발송해 드립니다.<br/>
                  새로운 인연을 위한 만남, 지금 키링크에서 시작하세요. <span style={{ color: '#888', fontSize: '0.8rem' }}>(문의: 인스타그램 @keylink_official DM)</span>
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowGuide(false)}
              style={{ width: '100%', marginTop: '24px', padding: '16px', background: '#FF6F61', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,111,97,0.2)' }}
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
'''

insert_pos = client_content.rfind('    </div>\n  );\n}')
if insert_pos != -1:
    client_content = client_content[:insert_pos] + modal_code + client_content[insert_pos:]

# 3. Remove "여성 우선 선발" from ClientPage
old_badge = """{session.isCustomCuration && !session.theme ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>
                      ) : (
                        (session.targetMaleAge && !session.theme) && (
                          <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                            남성 {session.targetMaleAge}
                          </p>
                        )
                      )}"""
new_badge = """{(!session.theme && session.targetMaleAge) && (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          남성 {session.targetMaleAge}
                        </p>
                      )}"""
client_content = client_content.replace(old_badge, new_badge)

with open('src/app/apply/fast/ClientPage.tsx', 'w') as f:
    f.write(client_content)


# 4. Remove "여성 우선 선발" from EventsSection
with open('src/components/EventsSection.tsx', 'r') as f:
    events_content = f.read()

events_old = """{event.isCustomCuration && !event.theme ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>❤️ 여성 우선 선발</span>
            </div>
            <div style={{ paddingLeft: '4px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                • 본 기수는 남성 연령대를 사전에 지정하지 않습니다.
              </p>
              <p style={{ fontSize: '0.68rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.4 }}>
                • 여성 참가자 우선 선발 후, 이상형과 나이대를<br/>
                <span style={{ paddingLeft: '8px' }}>세밀하게 맞추어 남성 참가자를 큐레이션합니다.</span>
              </p>
            </div>
          </div>
        ) : ("""

events_new = """{(!event.theme && event.targetMaleAge) && ("""

# wait, the original logic in EventsSection was:
#         {event.isCustomCuration && !event.theme ? (
#            ...
#         ) : (
#           (event.targetMaleAge && !event.theme) && (
#             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
# ...

# let's be more precise with regex or string split.
