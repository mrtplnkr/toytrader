import { useEffect, useState } from "react";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { GoodAppContext } from "../hooks/context";
import { Toy } from "../types/toy";
import { Offer } from "../types/offer";
import { Complaint } from "../types/complaint";
import { banUser, getComplaintList, getOfferById, getUserProfiles } from "../hooks/helper";

interface Profile {
    email?: string;
    displayName?: string;
}

interface RecentCommit {
    sha: string;
    shortSha: string;
    subject: string;
    date: string;
}

const GITHUB_REPO = "mrtplnkr/toytrader";

function notify(title: string, message: string, type: 'success' | 'danger') {
    Store.addNotification({
        title,
        message,
        type,
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: { duration: 5000, onScreen: true },
    });
}

function AdminPage() {
    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const [profilesByUid, setProfilesByUid] = useState<Record<string, Profile>>({});
    const [banningUid, setBanningUid] = useState<string | undefined>();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [offersByComplaint, setOffersByComplaint] = useState<Record<string, Offer | undefined>>({});
    const [recentCommits, setRecentCommits] = useState<RecentCommit[]>([]);
    const [commitsError, setCommitsError] = useState(false);

    useEffect(() => {
        // Public repo, unauthenticated read - GitHub's API allows this
        // cross-origin, no backend proxy needed. Rate-limited to 60
        // req/hour per IP, which is plenty for a page only an admin visits.
        fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=5`)
            .then((res) => {
                if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
                return res.json();
            })
            .then((data: Array<{ sha: string, commit: { message: string, author: { date: string } } }>) => {
                setRecentCommits(data.map((c) => ({
                    sha: c.sha,
                    shortSha: c.sha.slice(0, 7),
                    subject: c.commit.message.split('\n')[0],
                    date: c.commit.author.date,
                })));
            })
            .catch(() => setCommitsError(true));
    }, []);

    useEffect(() => {
        getComplaintList().then(setComplaints).catch(() => setComplaints([]));
    }, []);

    useEffect(() => {
        Promise.all(complaints.map((c) => getOfferById(c.offerId)))
            .then((fetchedOffers) => {
                const map: Record<string, Offer | undefined> = {};
                complaints.forEach((c, i) => { map[c.id] = fetchedOffers[i]; });
                setOffersByComplaint(map);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [complaints.length]);

    useEffect(() => {
        const uids = new Set<string>(toys.map((t: Toy) => t.userId));
        complaints.forEach((c) => { uids.add(c.reporterUid); uids.add(c.reportedUid); });
        if (!uids.size) return;
        getUserProfiles(Array.from(uids))
            .then((profiles) => {
                const map: Record<string, Profile> = {};
                profiles.forEach((p) => { map[p.uid] = { email: p.email, displayName: p.displayName }; });
                setProfilesByUid(map);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toys.length, complaints.length]);

    const nameFor = (uid: string) => profilesByUid[uid]?.email ?? profilesByUid[uid]?.displayName ?? uid;
    const toyTitle = (id?: string) => (id && toys.find((t: Toy) => t.id === id)?.title) || 'a toy (no longer listed)';

    const [toySearchQuery, setToySearchQuery] = useState('');
    const filteredToys = toys.filter((toy: Toy) => {
        const query = toySearchQuery.trim().toLowerCase();
        if (!query) return true;
        return toy.title.toLowerCase().includes(query) || nameFor(toy.userId).toLowerCase().includes(query);
    });

    const onBan = async (uid: string) => {
        if (!window.confirm(`Ban ${nameFor(uid)}? This disables their account and removes every toy they've listed.`)) {
            return;
        }
        try {
            setBanningUid(uid);
            const result = await banUser(uid);
            notify("User banned", `Removed ${result.bannedToyCount} listing(s).`, "success");
            await refresh();
        } catch (err) {
            notify("Unfortunately this action failed !", (err as Error).message, "danger");
        } finally {
            setBanningUid(undefined);
        }
    };

    return (
        <>
            <details style={{margin: '0 0 1.5em'}}>
                <summary style={{cursor: 'pointer', fontSize: '0.9em', color: 'var(--color-text-dim)'}}>
                    Recent commits ({recentCommits.length})
                </summary>
                <ul style={{fontSize: '0.85em', margin: '0.5em 0 0'}}>
                    {recentCommits.map((c) => (
                        <li key={c.sha} style={{marginBottom: '0.25em'}}>
                            <code>{c.shortSha}</code> {c.subject}
                            <span style={{color: 'var(--color-text-dim)'}}> — {new Date(c.date).toDateString()}</span>
                        </li>
                    ))}
                    {commitsError && <li>Couldn't load commit history from GitHub right now.</li>}
                </ul>
            </details>

            <h3>Admin - complaints</h3>
            {complaints.length === 0 && <p>No complaints filed.</p>}
            <ul id="complaintsList" style={{height: '420px', minHeight: '150px', overflowY: 'auto', resize: 'vertical'}}>
                {complaints.map((c) => {
                    const offer = offersByComplaint[c.id];
                    return (
                        <li key={c.id} style={{display: 'flex', flexDirection: 'column', gap: '0.5em', marginBottom: '1em'}}>
                            <div style={{fontSize: '0.85em', color: 'var(--color-text-dim)'}}>
                                {nameFor(c.reporterUid)} about {nameFor(c.reportedUid)} - {c.createdAt.toDateString()}
                            </div>
                            {offer &&
                                <div style={{fontSize: '0.85em'}}>Trade: {toyTitle(offer.toyOffered)} for {toyTitle(offer.toyTargeted)}</div>}
                            <div>{c.message}</div>
                            {c.photoFile && <img src={c.photoFile} alt="evidence" style={{width: '8em', borderRadius: 'var(--radius-sm)'}} />}
                            <button className="btn-danger" style={{alignSelf: 'flex-start'}}
                                disabled={banningUid === c.reportedUid} onClick={() => onBan(c.reportedUid)}>
                                {banningUid === c.reportedUid ? 'banning...' : `Ban ${nameFor(c.reportedUid)}`}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <h3>Admin - review toys</h3>
            <input
                type="text"
                placeholder="Search by toy name or user..."
                value={toySearchQuery}
                onChange={(e) => setToySearchQuery(e.target.value)}
                style={{marginBottom: '1em', width: '100%', maxWidth: '360px'}}
            />
            <ul id="toyList" style={{height: '420px', minHeight: '150px', overflowY: 'auto', resize: 'vertical'}}>
                {filteredToys.map((toy: Toy) => (
                    <li key={toy.id} style={{display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.75em'}}>
                        <img src={toy.file} alt={toy.title}
                            style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)'}} />
                        <div style={{flex: 1}}>
                            <div style={{fontWeight: 'bold'}}>{toy.title}</div>
                            <div style={{fontSize: '0.85em', color: 'var(--color-text-dim)'}}>{nameFor(toy.userId)}</div>
                        </div>
                        <button className="btn-danger" disabled={banningUid === toy.userId} onClick={() => onBan(toy.userId)}>
                            {banningUid === toy.userId ? 'banning...' : 'Ban poster'}
                        </button>
                    </li>
                ))}
            </ul>
            {toys.length === 0 && <p>No toys listed yet.</p>}
            {toys.length > 0 && filteredToys.length === 0 && <p>No toys match "{toySearchQuery}".</p>}
        </>
    );
}

export default AdminPage;
