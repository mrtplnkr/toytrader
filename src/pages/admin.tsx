import { useEffect, useState } from "react";
import { useContextSelector } from "use-context-selector";
import { Store } from "react-notifications-component";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { GoodAppContext } from "../hooks/context";
import { Toy } from "../types/toy";
import { Offer } from "../types/offer";
import { Complaint } from "../types/complaint";
import { banUser, BannedUser, getBannedUsers, getComplaintList, getOfferById, getUserProfiles, removeToy, unbanUser } from "../hooks/helper";
import adminEn from "../locales/en/admin.json";
import adminLt from "../locales/lt/admin.json";
import adminRu from "../locales/ru/admin.json";

// Statically imported here (not in src/i18n/index.ts) so these translations
// ride along in AdminPage's own lazy-loaded chunk instead of bloating the
// main bundle everyone downloads - addResourceBundle runs once, the first
// time this chunk is evaluated.
i18next.addResourceBundle('en', 'admin', adminEn);
i18next.addResourceBundle('lt', 'admin', adminLt);
i18next.addResourceBundle('ru', 'admin', adminRu);

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
    const { t } = useTranslation();
    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);
    const refresh = useContextSelector(GoodAppContext, (state: any) => state.refresh);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const [profilesByUid, setProfilesByUid] = useState<Record<string, Profile>>({});
    const [banningUid, setBanningUid] = useState<string | undefined>();
    const [removingToyId, setRemovingToyId] = useState<string | undefined>();
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [unbanningUid, setUnbanningUid] = useState<string | undefined>();
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
        getBannedUsers().then(setBannedUsers).catch(() => setBannedUsers([]));
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
        bannedUsers.forEach((b) => uids.add(b.uid));
        if (!uids.size) return;
        getUserProfiles(Array.from(uids))
            .then((profiles) => {
                const map: Record<string, Profile> = {};
                profiles.forEach((p) => { map[p.uid] = { email: p.email, displayName: p.displayName }; });
                setProfilesByUid(map);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toys.length, complaints.length, bannedUsers.length]);

    const bannedUidSet = new Set(bannedUsers.map((b) => b.uid));

    const nameFor = (uid: string) => profilesByUid[uid]?.email ?? profilesByUid[uid]?.displayName ?? uid;
    const toyTitle = (id?: string) => (id && toys.find((toy: Toy) => toy.id === id)?.title) || t('admin:toyNoLongerListed');

    const [toySearchQuery, setToySearchQuery] = useState('');
    const filteredToys = toys.filter((toy: Toy) => {
        const query = toySearchQuery.trim().toLowerCase();
        if (!query) return true;
        return toy.title.toLowerCase().includes(query) || nameFor(toy.userId).toLowerCase().includes(query);
    });

    const onBan = async (uid: string) => {
        if (!window.confirm(t('admin:confirmBan', { name: nameFor(uid) }))) {
            return;
        }
        try {
            setBanningUid(uid);
            const result = await banUser(uid);
            notify(t('admin:bannedTitle'), t('admin:bannedBody', { count: result.bannedToyCount }), "success");
            // We already know this uid is now banned - no need for a round
            // trip back to Firestore to find that out. Without this, a
            // complaint's "Ban {name}" button stayed active and clickable
            // even after that person was already banned.
            setBannedUsers((prev) => [...prev, { uid, bannedAt: new Date() }]);
            await refresh();
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), (err as Error).message, "danger");
        } finally {
            setBanningUid(undefined);
        }
    };

    const onUnban = async (uid: string) => {
        if (!window.confirm(t('admin:confirmUnban', { name: nameFor(uid) }))) {
            return;
        }
        try {
            setUnbanningUid(uid);
            await unbanUser(uid);
            notify(t('admin:unbannedTitle'), t('admin:unbannedBody', { name: nameFor(uid) }), "success");
            setBannedUsers((prev) => prev.filter((b) => b.uid !== uid));
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), (err as Error).message, "danger");
        } finally {
            setUnbanningUid(undefined);
        }
    };

    const onRemoveToy = async (toy: Toy) => {
        if (!window.confirm(t('admin:confirmRemoveToy', { title: toy.title }))) {
            return;
        }
        try {
            setRemovingToyId(toy.id);
            await removeToy(toy.id);
            notify(t('admin:toyRemovedTitle'), t('admin:toyRemovedBody', { title: toy.title }), "success");
            await refresh();
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), (err as Error).message, "danger");
        } finally {
            setRemovingToyId(undefined);
        }
    };

    return (
        <>
            <details className="mb-6">
                <summary className="cursor-pointer text-[0.9em] text-text-dim">
                    {t('admin:recentCommits', { count: recentCommits.length })}
                </summary>
                <ul className="text-[0.85em] mt-2 mb-0">
                    {recentCommits.map((c) => (
                        <li key={c.sha} className="mb-1">
                            <code>{c.shortSha}</code> {c.subject}
                            <span className="text-text-dim"> — {new Date(c.date).toDateString()}</span>
                        </li>
                    ))}
                    {commitsError && <li>{t('admin:commitsError')}</li>}
                </ul>
            </details>

            <h3>{t('admin:complaintsHeading')}</h3>
            {complaints.length === 0 && <p>{t('admin:noComplaints')}</p>}
            <ul id="complaintsList" className="h-[420px] min-h-[150px] overflow-y-auto resize-y">
                {complaints.map((c) => {
                    const offer = offersByComplaint[c.id];
                    return (
                        <li key={c.id} className="flex flex-col gap-2 mb-4">
                            <div className="text-[0.85em] text-text-dim">
                                {t('admin:complaintBy', {
                                    reporter: nameFor(c.reporterUid),
                                    reported: nameFor(c.reportedUid),
                                    date: c.createdAt.toDateString(),
                                })}
                            </div>
                            {offer &&
                                <div className="text-[0.85em]">
                                    {t('admin:tradeLine', { toyOffered: toyTitle(offer.toyOffered), toyTargeted: toyTitle(offer.toyTargeted) })}
                                </div>}
                            <div>{c.message}</div>
                            {c.photoFile && <img src={c.photoFile} alt="evidence" className="w-[8em] rounded-sm" />}
                            {bannedUidSet.has(c.reportedUid) ?
                                <p className="text-[0.85em] text-text-dim m-0">{t('admin:alreadyBanned')}</p>
                            :
                                <button className="btn-danger self-start"
                                    disabled={banningUid === c.reportedUid} onClick={() => onBan(c.reportedUid)}>
                                    {banningUid === c.reportedUid ? t('admin:banning') : t('admin:banUser', { name: nameFor(c.reportedUid) })}
                                </button>}
                        </li>
                    );
                })}
            </ul>

            <h3>{t('admin:toysHeading')}</h3>
            <input
                type="text"
                placeholder={t('admin:searchPlaceholder')}
                value={toySearchQuery}
                onChange={(e) => setToySearchQuery(e.target.value)}
                className="mb-4 w-full max-w-[360px]"
            />
            <ul id="toyList" className="h-[420px] min-h-[150px] overflow-y-auto resize-y">
                {filteredToys.map((toy: Toy) => (
                    <li key={toy.id} className="flex items-center gap-4 mb-3">
                        <img src={toy.file} alt={toy.title}
                            className="w-[60px] h-[60px] object-cover rounded-sm" />
                        <div className="flex-1">
                            <div className="font-bold">{toy.title}</div>
                            <div className="text-[0.85em] text-text-dim">{nameFor(toy.userId)}</div>
                        </div>
                        <button className="btn-danger" disabled={removingToyId === toy.id} onClick={() => onRemoveToy(toy)}>
                            {removingToyId === toy.id ? t('admin:removing') : t('admin:removeToy')}
                        </button>
                        <button className="btn-danger" disabled={banningUid === toy.userId} onClick={() => onBan(toy.userId)}>
                            {banningUid === toy.userId ? t('admin:banning') : t('admin:banPoster')}
                        </button>
                    </li>
                ))}
            </ul>
            {toys.length === 0 && <p>{t('admin:noToysYet')}</p>}
            {toys.length > 0 && filteredToys.length === 0 && <p>{t('admin:noToysMatch', { query: toySearchQuery })}</p>}

            <h3>{t('admin:bannedUsersHeading')}</h3>
            {bannedUsers.length === 0 && <p>{t('admin:noBannedUsers')}</p>}
            <ul id="bannedUsersList">
                {bannedUsers.map((b) => (
                    <li key={b.uid} className="flex items-center gap-4 mb-3">
                        <div className="flex-1">
                            <div className="font-bold">{nameFor(b.uid)}</div>
                            {b.bannedAt &&
                                <div className="text-[0.85em] text-text-dim">
                                    {t('admin:bannedOn', { date: b.bannedAt.toDateString() })}
                                </div>}
                            {b.reason &&
                                <div className="text-[0.85em] text-text-dim">{b.reason}</div>}
                        </div>
                        <button className="btn-primary" disabled={unbanningUid === b.uid} onClick={() => onUnban(b.uid)}>
                            {unbanningUid === b.uid ? t('admin:unbanning') : t('admin:unban')}
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
}

export default AdminPage;
