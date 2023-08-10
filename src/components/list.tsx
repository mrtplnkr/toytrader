import { collection, 
  getDocs, deleteDoc,
  doc, 
  query,
  where} from "firebase/firestore";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
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
      const q = await query(toysCollectionRef, where("userId", "!=", "UtGuMAEDsQbkAKqNstSQ4R9D5uw2"))//await query(data.docs)
      let da = new Array<Toy>();
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());
        const d = doc.data();
        da.push({
          id: doc.id,
          userId: d.userId,
          title: d.title,
          file: d.file,
        })
      }); 
      if (da.length) setToyList(da);
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
        {toyList.length && toyList.map((x) => {
          return (
            <Item key={x.id} {...x} 
              isOwned={x.userId === auth?.currentUser?.uid} deleteItem={deleteItem} 
              wished={myWishedItems.filter(w => w.id === x.id).length} addRemoveWish={addRemoveWish}>
            </Item>)
        })}
      </ul>
    </>
  );
}

export default ListPage;