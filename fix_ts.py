with open('src/app/apply/fast/ClientPage.tsx', 'r') as f:
    client = f.read()
client = client.replace(r"parseInt(session.title.match(/(\d+)기/)[1], 10)", r"parseInt(session.title.match(/(\d+)기/)?.[1] || '0', 10)")
with open('src/app/apply/fast/ClientPage.tsx', 'w') as f:
    f.write(client)

with open('src/components/EventsSection.tsx', 'r') as f:
    events = f.read()
events = events.replace(r"parseInt(event.title.match(/(\d+)기/)[1], 10)", r"parseInt(event.title.match(/(\d+)기/)?.[1] || '0', 10)")
with open('src/components/EventsSection.tsx', 'w') as f:
    f.write(events)
