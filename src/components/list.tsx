import { collection, 
  getDocs, deleteDoc,
  doc, 
  query,
  where} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TLSSocket } from "tls";
import { auth, db, storage } from "../firebase-config";
import { useUserContext } from "../hooks/context";
import Item from "./item";

interface Toy {
  title: string;
  id: string;
  file: string;
  userId: string;
}

function ListPage() {
  let navigate = useNavigate();

  const [toyList, setToyList] = useState(Array<Toy>);

  const toysCollectionRef = collection(db, "toys");

  useEffect(() => {
    getToyList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [myWishedItems, setMyWishedItems] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("'wishListItems", JSON.stringify(myWishedItems))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWishedItems?.length]);

  const addRemoveWish = (newItem: any) => {
      if (myWishedItems && myWishedItems.filter(x => x.id === newItem.id).length) {
        setMyWishedItems(myWishedItems.filter(x => x.id !== newItem.id));
      } else {
        setMyWishedItems(myWishedItems.concat([newItem]));
      }
  }

  const deleteItem = async (id: string) => {
    const movieDoc = doc(db, "toys", id);
    await deleteDoc(movieDoc);
    getToyList();
  };
  
  const getToyList = async () => {
    try {
      const q = await query(toysCollectionRef, where("userId", "!=", auth?.currentUser?.uid))//await query(data.docs)
      const querySnapshot = await getDocs(q);
      await querySnapshot.forEach(async (doc) => {
        // doc.data() is never undefined for query doc snapshots
        const d = doc.data();
        const filesFolderRef = ref(storage, `projectFiles/${d.file}`);
        const url = await getDownloadURL(filesFolderRef);
        
        setToyList(a => [...a, {
          id: doc.id,
          userId: d.userId,
          title: d.title,
          file: url,
        }]);
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <h3>All other toys in your area</h3>

      <div style={{display: 'flex', flexDirection: 'column'}}>
        <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
        <button style={{alignSelf: 'flex-start'}} onClick={() => getToyList()}>refresh</button>
      </div>

      <ul id="toyList">
        {toyList.length > 0 ? toyList.map((x) => {
          return (
            <Item key={x.id} {...x} 
              isOwned={x.userId === auth?.currentUser?.uid} deleteItem={deleteItem} 
              wished={myWishedItems.filter(w => w.id === x.id).length} addRemoveWish={addRemoveWish}>
            </Item>)
        }) : <div>nothing in your area</div>}
      </ul>
    </>
  );
}

export default ListPage;