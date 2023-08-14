
const urlFormat = 
    'https://firebasestorage.googleapis.com/v0/b/toystrader-a494f.appspot.com/o/projectFiles/<FILE>?alt=media&token=<TOKEN>';

// export interface Toy {
//     title: string;
//     id: string;
//     file: string;
//     userId: string;
//     token?: string;
//     isOwned?: boolean;
//     wished?: boolean;
// }

interface ItemProps {
    title: string;
    id: string;
    file: string;
    userId: string;
    isOwned: boolean;
    wished: boolean;
    deleteItem: any;
    addRemoveWish: any;
}

function Item(props: any) {

    return (
        <li>
            {props.isOwned && <button onClick={() => props.deleteItem(props.id)}>del</button>}
            <img alt={props.title} src={props.file} />
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                <span style={{flex: 1}}>{props.title}</span>
                <button style={{ alignSelf: 'center' }} onClick={() => props.addRemoveWish(props)}>
                    {props.wished ? 'wished' : 'wish'}</button>
            </div>
            <span style={{flex: 1}}>{props.userId}</span>
        </li>
    );
}

export default Item;
