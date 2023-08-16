import { deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import { DashboardContext } from "../hooks/context";
import Item from "../components/item";
import { getToyList } from "../hooks/helper";
import { Toy } from "../types/toy";
  
function MyToysPage() {
  let navigate = useNavigate();

  const [toyList, setToyList] = useState<Array<Toy>>([]);

  useEffect(() => {
    getToys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToys = async () => {
    setToyList(await getToyList(true));
  }

  useEffect(() => {
      if (toyList.length > 0) localStorage.setItem('myToys', toyList.length.toString())
  }, [toyList.length])

  const deleteItem = async (id: string) => {
    const movieDoc = doc(db, "toys", id);
    await deleteDoc(movieDoc);
    await getToys();
  };
  

  return (
    <>
      <DashboardContext.Provider value={{
        userId: auth?.currentUser?.uid,
        userName: auth?.currentUser?.displayName,
        photoUrl: auth?.currentUser?.photoURL,
      }}>
        <h3>All your toys</h3>
  
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => getToys()}>refresh</button>
        </div>
  
        <ul id="toyList">
          {toyList.length > 0 ? toyList.map((x) => {
            return (
              <Item key={x.id} {...x} deleteItem={deleteItem} />
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
      </DashboardContext.Provider>
    </>
  );
}

export default MyToysPage;