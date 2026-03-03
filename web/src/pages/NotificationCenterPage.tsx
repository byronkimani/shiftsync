import NotificationPanel from '../components/notifications/NotificationPanel';

export default function NotificationCenterPage() {
    return (
        <main className="max-w-2xl mx-auto h-[calc(100vh-64px)] md:h-[calc(100vh-32px)] md:py-8 px-0 sm:px-6 lg:px-8">
            <div className="h-full bg-white md:rounded-xl md:shadow-md border-x md:border border-gray-200 overflow-hidden">
                <NotificationPanel isSlideOver={false} />
            </div>
        </main>
    );
}
