import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Composer } from './components/Composer';
import { EmailList } from './components/EmailList';
import { Button, Modal } from './components/Modal';
import { PixelSkull } from './components/PixelDecor';
import { Reader } from './components/Reader';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { Toast, type ToastData } from './components/Toast';
import { SAMPLE_EMAIL_COUNT } from './data/emails';
import { unsubscribeErrors } from './data/comebacks';
import { countsFor, emailsForView, mailboxReducer, searchEmails } from './lib/mailbox';
import { buildComebackEmail } from './lib/replyEngine';
import { generateRoast } from './lib/roastEngine';
import { playChime } from './lib/sound';
import { loadState, saveState } from './lib/storage';
import type { Email, Intensity, IntensityFilter, View } from './types';

type ModalState = { kind: 'unsubscribe'; message: string; code: string } | { kind: 'reset' } | { kind: 'emptyTrash' } | null;

export default function App() {
  const [state, dispatch] = useReducer(mailboxReducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [view, setView] = useState<View>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [intensityFilter, setIntensityFilter] = useState<IntensityFilter>('all');
  const [summonIntensity, setSummonIntensity] = useState<Intensity>(state.settings.defaultIntensity);
  const [summoning, setSummoning] = useState(false);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [composerFor, setComposerFor] = useState<Email | null>(null);
  const [sending, setSending] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastUnsub = useRef(-1);
  const toastTimer = useRef<number>();

  const { settings } = state;
  const summonMs = settings.reduceMotion ? 300 : 1500;

  // Persist every change.
  useEffect(() => saveState(state), [state]);

  // Keep the summon picker in sync when the default changes in Settings.
  useEffect(() => setSummonIntensity(settings.defaultIntensity), [settings.defaultIntensity]);

  const counts = useMemo(() => countsFor(state.emails), [state.emails]);

  useEffect(() => {
    document.title = counts.unread > 0 ? `(${counts.unread}) Inbox From Nowhere` : 'Inbox From Nowhere';
  }, [counts.unread]);

  const listView: Exclude<View, 'settings'> = view === 'settings' ? 'inbox' : view;
  const inView = useMemo(() => emailsForView(state.emails, listView), [state.emails, listView]);
  const visible = useMemo(() => searchEmails(inView, query, intensityFilter), [inView, query, intensityFilter]);
  const selected = state.emails.find((e) => e.id === selectedId) ?? null;

  const showToast = useCallback((t: Omit<ToastData, 'id'>, ttl = 4200) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...t, id: Date.now() });
    if (ttl > 0) toastTimer.current = window.setTimeout(() => setToast(null), ttl);
  }, []);

  const navigate = (v: View) => {
    setView(v);
    setSelectedId(null);
    setDrawerOpen(false);
  };

  const select = (id: string) => {
    setSelectedId(id);
    const email = stateRef.current.emails.find((e) => e.id === id);
    if (email && !email.read) dispatch({ type: 'markRead', id, read: true });
  };

  const openFromToast = (id: string) => {
    const email = stateRef.current.emails.find((e) => e.id === id);
    if (!email) return;
    if (!emailsForView(stateRef.current.emails, listView).some((e) => e.id === id)) setView('inbox');
    setQuery('');
    setIntensityFilter('all');
    select(id);
    setToast(null);
  };

  const summon = () => {
    if (summoning) return;
    setSummoning(true);
    setDrawerOpen(false);
    showToast({ kind: 'loading', title: 'Consulting the Department of Personal Attacks...' }, 0);
    window.setTimeout(() => {
      const current = stateRef.current;
      const { email, signature } = generateRoast({
        lore: current.lore,
        intensity: summonIntensity,
        recentSignatures: current.recentSignatures,
      });
      dispatch({ type: 'addEmail', email, signature });
      setArrivedId(email.id);
      setSummoning(false);
      showToast({ kind: 'mail', title: "You've got mail. Unfortunately.", detail: `${email.sender.name}: ${email.subject}`, emailId: email.id }, 5200);
      if (current.settings.sound) playChime();
    }, summonMs);
  };

  const sendReply = (text: string) => {
    if (!composerFor) return;
    const original = composerFor;
    setSending(true);
    window.setTimeout(() => {
      const reply = buildComebackEmail(original, text);
      dispatch({ type: 'addEmail', email: reply });
      setArrivedId(reply.id);
      setSending(false);
      setComposerFor(null);
      showToast({ kind: 'mail', title: 'They wrote back. Of course they did.', detail: reply.subject, emailId: reply.id }, 5200);
      if (stateRef.current.settings.sound) playChime();
    }, settings.reduceMotion ? 200 : 900);
  };

  const unsubscribe = () => {
    let i = Math.floor(Math.random() * unsubscribeErrors.length);
    if (i === lastUnsub.current) i = (i + 1) % unsubscribeErrors.length;
    lastUnsub.current = i;
    const code = `ERR_${(Math.floor(Math.random() * 0xfffff) + 0x10000).toString(16).toUpperCase()}`;
    setModal({ kind: 'unsubscribe', message: unsubscribeErrors[i], code });
  };

  const leaveReader = (msg: string) => {
    setSelectedId(null);
    showToast({ kind: 'info', title: msg }, 2400);
  };

  return (
    <div className={`flex h-[100dvh] w-full overflow-hidden bg-night text-ivory ${settings.reduceMotion ? 'reduce-motion' : ''}`}>
      {/* Sidebar: fixed column on desktop, drawer on mobile */}
      <div className="hidden md:flex">
        <Sidebar
          view={view}
          counts={counts}
          onNavigate={navigate}
          onSummon={summon}
          summoning={summoning}
          summonIntensity={summonIntensity}
          onSummonIntensity={setSummonIntensity}
        />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" onMouseDown={() => setDrawerOpen(false)}>
          <div className="animate-drawer h-full" onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar
              view={view}
              counts={counts}
              onNavigate={navigate}
              onSummon={summon}
              summoning={summoning}
              summonIntensity={summonIntensity}
              onSummonIntensity={setSummonIntensity}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
          <div className="flex-1 bg-night/70 backdrop-blur-sm" />
        </div>
      )}

      {view === 'settings' ? (
        <SettingsView
          lore={state.lore}
          settings={settings}
          onSaveLore={(lore) => dispatch({ type: 'updateLore', lore })}
          onUpdateSettings={(s) => dispatch({ type: 'updateSettings', settings: s })}
          onRequestReset={() => setModal({ kind: 'reset' })}
          onOpenMenu={() => setDrawerOpen(true)}
        />
      ) : (
        <>
          <EmailList
            view={listView}
            emails={visible}
            totalInView={inView.length}
            selectedId={selectedId}
            arrivedId={arrivedId}
            query={query}
            onQuery={setQuery}
            intensityFilter={intensityFilter}
            onIntensityFilter={setIntensityFilter}
            onSelect={select}
            onEmptyTrash={() => setModal({ kind: 'emptyTrash' })}
            onOpenMenu={() => setDrawerOpen(true)}
            onSummon={summon}
            summoning={summoning}
          />
          <Reader
            email={selected}
            onBack={() => setSelectedId(null)}
            onToggleRead={(e) => {
              dispatch({ type: 'markRead', id: e.id, read: !e.read });
              if (e.read) leaveReader('Marked as unread. Pretend you never saw it.');
            }}
            onToggleStar={(e) => dispatch({ type: 'toggleStar', id: e.id })}
            onArchive={(e) => {
              dispatch({ type: 'archive', id: e.id });
              leaveReader('Filed in the Archive of Shame.');
            }}
            onTrash={(e) => {
              dispatch({ type: 'trash', id: e.id });
              leaveReader('Moved to Trash. It will be remembered.');
            }}
            onRestore={(e) => {
              dispatch({ type: 'restore', id: e.id });
              leaveReader(e.folder === 'trash' ? 'Restored. It missed you.' : 'Back in the Inbox, where it belongs.');
            }}
            onDeleteForever={(e) => {
              dispatch({ type: 'deleteForever', id: e.id });
              leaveReader('Deleted forever. The sender felt that.');
            }}
            onReply={(e) => setComposerFor(e)}
            onUnsubscribe={unsubscribe}
          />
        </>
      )}

      {composerFor && <Composer email={composerFor} sending={sending} onSend={sendReply} onClose={() => !sending && setComposerFor(null)} />}

      {toast && <Toast toast={toast} summonMs={summonMs} onOpen={openFromToast} onDismiss={() => setToast(null)} />}

      {modal?.kind === 'unsubscribe' && (
        <Modal
          title="Unsubscribe failed"
          eyebrow={modal.code}
          onClose={() => setModal(null)}
          actions={
            <>
              <Button onClick={unsubscribe}>Try again (futile)</Button>
              <Button variant="primary" onClick={() => setModal(null)}>
                Accept fate
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <PixelSkull className="mt-1 h-6 w-6 shrink-0" />
            <p className="font-mono text-[13px] leading-relaxed text-blush">{modal.message}</p>
          </div>
        </Modal>
      )}

      {modal?.kind === 'reset' && (
        <Modal
          title="Reset the sample inbox?"
          eyebrow="are you sure"
          onClose={() => setModal(null)}
          actions={
            <>
              <Button onClick={() => setModal(null)}>Keep my suffering</Button>
              <Button
                variant="danger"
                onClick={() => {
                  dispatch({ type: 'reset' });
                  setModal(null);
                  setView('inbox');
                  setSelectedId(null);
                  showToast({ kind: 'info', title: 'Inbox reset. The universe has reloaded its insults.' }, 3000);
                }}
              >
                Reset inbox
              </Button>
            </>
          }
        >
          This restores the {SAMPLE_EMAIL_COUNT} original emails and removes everything you summoned or received in reply. Your lore and settings stay.
        </Modal>
      )}

      {modal?.kind === 'emptyTrash' && (
        <Modal
          title="Empty the Trash?"
          eyebrow="permanent"
          onClose={() => setModal(null)}
          actions={
            <>
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  dispatch({ type: 'emptyTrash' });
                  setModal(null);
                  setSelectedId(null);
                  showToast({ kind: 'info', title: 'Trash emptied. The criticism has been composted.' }, 2400);
                }}
              >
                Empty Trash
              </Button>
            </>
          }
        >
          {counts.trash} {counts.trash === 1 ? 'message' : 'messages'} will be deleted from this browser for good.
        </Modal>
      )}
    </div>
  );
}
