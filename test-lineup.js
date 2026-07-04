const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = 'keylink-87771';

async function fetchLineup() {
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'sessions' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'episodeNumber' },
          op: 'EQUAL',
          value: { integerValue: 131 }
        }
      }
    }
  };

  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify(query)
  });
  const data = await res.json();
  const sessionId = data[0].document.name.split('/').pop();
  console.log('Session ID:', sessionId);

  const appsQuery = {
    structuredQuery: {
      from: [{ collectionId: 'applications' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'sessionId' },
                op: 'EQUAL',
                value: { stringValue: sessionId }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'confirmed' }
              }
            }
          ]
        }
      }
    }
  };

  const appsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify(appsQuery)
  });
  const appsData = await appsRes.json();
  
  if (!appsData || !appsData[0] || !appsData[0].document) {
      console.log('No confirmed apps found');
      return;
  }
  
  const apps = appsData.map(d => {
    const fields = d.document.fields;
    return {
      name: fields.name?.stringValue,
      gender: fields.gender?.stringValue,
      slotNumber: fields.slotNumber?.integerValue,
      isTest: fields.isTest?.booleanValue,
      id: d.document.name.split('/').pop()
    };
  });
  console.log(apps.sort((a,b) => (parseInt(a.slotNumber)||0) - (parseInt(b.slotNumber)||0)));
}
fetchLineup().catch(console.error);
