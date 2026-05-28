#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarPlayModule, RCTEventEmitter)
RCT_EXTERN_METHOD(startTrip:(NSDictionary *)params)
RCT_EXTERN_METHOD(updateManeuver:(NSDictionary *)params)
RCT_EXTERN_METHOD(endTrip)
RCT_EXTERN_METHOD(updateMapCenter:(NSDictionary *)params)
@end
