const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('portal_access_token');
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: import.meta.env.VITE_APP_ID,
		token: !isNode ? window.localStorage.getItem('portal_access_token') : null,
		functionsVersion: import.meta.env.VITE_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_APP_BASE_URL,
	}
}


export const appParams = {
	...getAppParams()
}
