import re

with open('src/app/apply/fast/ClientPage.tsx', 'r') as f:
    client = f.read()
    
# In ClientPage.tsx
old_badge_client = "{(!session.theme && session.targetMaleAge) && ("
new_badge_client = "{(!session.theme && session.targetMaleAge && (!session.title.match(/(\\d+)기/) || parseInt(session.title.match(/(\\d+)기/)[1], 10) < 137)) && ("
client = client.replace(old_badge_client, new_badge_client)

with open('src/app/apply/fast/ClientPage.tsx', 'w') as f:
    f.write(client)


with open('src/components/EventsSection.tsx', 'r') as f:
    events = f.read()

# In EventsSection.tsx
old_badge_events = "{(event.targetMaleAge && !event.theme) && ("
new_badge_events = "{(event.targetMaleAge && !event.theme && (!event.title.match(/(\\d+)기/) || parseInt(event.title.match(/(\\d+)기/)[1], 10) < 137)) && ("
events = events.replace(old_badge_events, new_badge_events)

with open('src/components/EventsSection.tsx', 'w') as f:
    f.write(events)

