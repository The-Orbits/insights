import { defineComponent, onMounted, type PropType } from "vue";
import { injectSpeedInsights, type BeforeSend, type SpeedInsightsOptions } from "./index";

export type { BeforeSend, SpeedInsightsOptions } from "./index";

/** Reports Core Web Vitals from the root component (App.vue, or app.vue in Nuxt). Renders nothing. */
export const SpeedInsights = defineComponent({
  name: "OrbitsSpeedInsights",
  props: {
    mode: String as PropType<SpeedInsightsOptions["mode"]>,
    debug: { type: Boolean, default: undefined },
    sampleRate: Number,
    beforeSend: Function as PropType<BeforeSend>,
    scriptSrc: String,
    endpoint: String,
  },
  setup(props) {
    onMounted(() => injectSpeedInsights({ ...props }));
    return () => null;
  },
});
