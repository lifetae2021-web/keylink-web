import re

with open('src/components/EventsSection.tsx', 'r') as f:
    events_content = f.read()

# Original block:
#         {event.isCustomCuration && !event.theme ? (
#           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
#             <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
#               <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>❤️ 여성 우선 선발</span>
#             </div>
#             <div style={{ paddingLeft: '4px' }}>
#               <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
#                 • 본 기수는 남성 연령대를 사전에 지정하지 않습니다.
#               </p>
#               <p style={{ fontSize: '0.68rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.4 }}>
#                 • 여성 참가자 우선 선발 후, 이상형과 나이대를<br/>
#                 <span style={{ paddingLeft: '8px' }}>세밀하게 맞추어 남성 참가자를 큐레이션합니다.</span>
#               </p>
#             </div>
#           </div>
#         ) : (
#           (event.targetMaleAge && !event.theme) && (

# Let's replace the whole ternary logic with just the targetMaleAge check

old_block_start = events_content.find('{event.isCustomCuration && !event.theme ? (')
if old_block_start != -1:
    old_block_end = events_content.find('          (event.targetMaleAge && !event.theme) && (', old_block_start)
    if old_block_end != -1:
        # we found it, but we need to also remove the closing `)}` corresponding to the ternary operator
        # It looks like:
        #           (event.targetMaleAge && !event.theme) && (
        #             ...
        #           )
        #         )}
        # We can just replace `{event.isCustomCuration && !event.theme ? ( ... ) : (` with `{`
        
        chunk_to_replace = events_content[old_block_start:old_block_end]
        events_content = events_content.replace(chunk_to_replace, '{')
        
        # Now we have `{          (event.targetMaleAge && !event.theme) && (`
        # But wait, there is an extra closing `}` at the end of this ternary block.
        # Let's write out exactly what it should be.
        pass

