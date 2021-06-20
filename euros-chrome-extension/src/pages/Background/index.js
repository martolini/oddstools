// import { initializeApp } from 'firebase/app';
// import {
//   getFirestore,
//   collection,
//   query,
//   where,
//   getDocs,
// } from 'firebase/firestore';

// const config = {
//   apiKey: 'AIzaSyDlaZg5VVzpTkTA1Tv_j3W2Pwg1HLrFXHY',
//   authDomain: 'euros-chrome-e.firebaseapp.com',
//   projectId: 'euros-chrome-e',
//   storageBucket: 'euros-chrome-e.appspot.com',
//   messagingSenderId: '1044605694569',
//   appId: '1:1044605694569:web:3c1b877de8a8d5acfe68f8',
//   measurementId: 'G-YKMCYNDH9X',
// };
// const firebaseApp = initializeApp(config);
// const db = getFirestore(firebaseApp);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('GOT MESSAGE', request, sender);
  const { teams } = request;
  if (teams) {
    const url = `https://storage.googleapis.com/nt-odds/${teams[0]}_${teams[1]}.json`;
    fetch(url)
      .then((res) => res.json())
      .then(sendResponse)
      .catch(console.error);
  }
  return true;
  // const { homeTeam, awayTeam } = request;
  // const q = query(
  //   collection(db, 'selections'),
  //   where('homeTeam', '==', homeTeam),
  //   where('awayTeam', '==', awayTeam)
  // );
  // const snapshot = await getDocs(q);
  // const docs = [];
  // snapshot.forEach((doc) => {
  //   docs.append(doc.data());
  // });
  // sendResponse(docs);
});
