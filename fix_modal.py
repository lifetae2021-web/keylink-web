import re

with open('src/app/apply/fast/ClientPage.tsx', 'r') as f:
    client_content = f.read()

# The modal starts with {/* ─── Guide Modal ─── */}
# And ends with a closing </div> corresponding to it, before `    </div>\n  );\n}` in SelectField.
modal_start = client_content.find('{/* ─── Guide Modal ─── */}')
if modal_start != -1:
    modal_end_str = '        </div>\n      )}\n'
    modal_end = client_content.find(modal_end_str, modal_start) + len(modal_end_str)
    
    modal_code = client_content[modal_start:modal_end]
    client_content = client_content[:modal_start] + client_content[modal_end:]
    
    # Find the end of FastApplyContent. FastApplyContent ends with:
    #       {/* ─── Non-Member PIN Setup Modal ─── */}
    #       {pinModalOpen && ( ... )}
    #     </div>
    #   );
    # }
    
    # We can just insert it right before the last `    </div>\n  );\n}` before `/* ── Small helper components ── */`
    helper_start = client_content.find('/* ── Small helper components ── */')
    insert_pos = client_content.rfind('    </div>\n  );\n}', 0, helper_start)
    if insert_pos != -1:
        client_content = client_content[:insert_pos] + modal_code + client_content[insert_pos:]
    
    with open('src/app/apply/fast/ClientPage.tsx', 'w') as f:
        f.write(client_content)
    print("Fixed modal position.")
else:
    print("Modal not found.")
