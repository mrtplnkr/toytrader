import { collection, 
  getDocs,
  query,
  where} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase-config";
import Item from "./item";

interface Toy {
  title: string;
  id: string;
  file: string;
  userId: string;
}

function ListPage() {
  let navigate = useNavigate();

  const [toyList, setToyList] = useState<Array<Toy>>([]);

  const toysCollectionRef = collection(db, "toys");

  useEffect(() => {
    getToyList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [myWishedItems, setMyWishedItems] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("wishListItems", JSON.stringify(myWishedItems))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWishedItems?.length]);

  const addRemoveWish = (newItem: any) => {
      if (myWishedItems && myWishedItems.filter(x => x.id === newItem.id).length) {
        setMyWishedItems(myWishedItems.filter(x => x.id !== newItem.id));
      } else {
        setMyWishedItems(myWishedItems.concat([newItem]));
      }
  }

  const getToyList = async () => {
    try {
      setToyList([]);
      const q = query(toysCollectionRef, where("userId", "!=", auth?.currentUser?.uid))
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
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
            <Item key={x.id} {...x} addRemoveWish={addRemoveWish}
              wished={myWishedItems.filter(w => w.id === x.id).length > 0} /> )
        }) :
        <div style={{fontSize: '0.5em'}}>
          <h2>nothing in your area</h2>
          <h3 style={{textDecoration: 'underline'}}>update your location settings</h3>
        </div>}
      </ul>
    </>
  );
}

export default ListPage;